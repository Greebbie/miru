import { useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useConfigStore } from '@/stores/configStore'
import { useCharacterStore } from '@/stores/characterStore'
import type { Message as AIMessage, ToolCallRequest, ToolResult } from '@/core/ai/provider'
import { createProvider } from '@/core/ai/createProvider'
import { parseLocal } from '@/core/parser/local'
import { toolRegistry } from '@/core/tools'
import { injectMemory } from '@/core/memory/injector'
import { extractFromConversation } from '@/core/memory/extractor'
import { pruneMessages, estimateTokens, estimateMessageTokens } from '@/core/ai/tokenBudget'
import { buildSystemPrompt } from '@/core/ai/systemPrompt'
import { skillRegistry } from '@/core/skills/registry'
import { executeSkill } from '@/core/skills/executor'
import { useCostStore } from '@/stores/costStore'
import { speakText } from '@/core/tts'
import { humanizeError } from '@/core/errors/humanize'
import { describeToolAction } from '@/core/tools/describe'
import { playSound } from '@/core/sound'
import { messages } from '@/i18n/messages'

const MAX_TOOL_ROUNDS = 5

/** Get a translated string using current language setting */
function msg(key: string): string {
  const lang = useConfigStore.getState().language
  const eff = lang === 'en' ? 'en' : lang === 'zh' ? 'zh' : (navigator.language.startsWith('zh') ? 'zh' : 'en')
  return messages[eff]?.[key] || messages.zh[key] || key
}

/**
 * Get active window context with timeout. Returns empty string on failure.
 */
async function getScreenContext(): Promise<string> {
  if (!window.electronAPI) return ''
  try {
    const result = await Promise.race([
      window.electronAPI.getActiveWindow(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    if (result) {
      return `${result.app} - ${result.title || '(no title)'}`
    }
  } catch (err) { console.warn('[Niromi] getScreenContext:', err) }
  return ''
}

/**
 * Get vision context if enabled. Returns Layer 0 info (window title, zero tokens).
 * Actual screen analysis is handled by describe_screen/describe_window tools on demand.
 */
async function getVisionContext(): Promise<string> {
  const config = useConfigStore.getState()
  if (config.visionTarget === 'off') return ''
  if (!window.electronAPI) return ''
  try {
    const targetInfo = config.visionTarget === 'fullscreen'
      ? 'fullscreen'
      : `window: ${config.visionTarget}`
    const win = await window.electronAPI.getActiveWindow()
    return `[Vision ON, target: ${targetInfo}] Active: ${win.app} - ${win.title}. Call describe_screen to capture.`
  } catch {
    return ''
  }
}

export function useAI() {
  const abortRef = useRef<AbortController | null>(null)
  const isProcessingRef = useRef(false)

  const sendMessage = useCallback(async (text: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    try {
    const chatStore = useChatStore.getState()
    const charStore = useCharacterStore.getState()

    // Add user message
    chatStore.addMessage({ role: 'user', content: text })
    chatStore.setStreaming(true)
    charStore.setEmotions({ curiosity: 0.8 })

    // Step 1: Try local parser first (zero tokens!)
    const localMatch = parseLocal(text)
    if (localMatch) {
      // Handle direct response (e.g. current time) — zero token, no tool needed
      if (localMatch.directResponse) {
        chatStore.addMessage({
          role: 'assistant',
          content: localMatch.directResponse,
        })
        charStore.setEmotions({ joy: 0.5 })
        return
      }

      // Handle skill match
      if (localMatch.skill) {
        const skill = skillRegistry.get(localMatch.skill)
        if (skill?.execute) {
          try {
            await skill.execute(text)
            charStore.setEmotions({ joy: 0.6 })
          } catch (err) {
            console.warn('[Niromi] Skill execute error:', err)
            chatStore.addMessage({
              role: 'assistant',
              content: humanizeError(err, useConfigStore.getState().language),
            })
            charStore.setEmotions({ concern: 0.7 })
          }
          return
        } else if (skill?.steps) {
          try {
            const result = await executeSkill(skill, text, (step, total, summary) => {
              useChatStore.getState().appendToLastMessage(`\n⏳ Step ${step}/${total}: ${summary}`)
            })
            chatStore.addMessage({
              role: 'assistant',
              content: result.success
                ? `✨ ${result.summary}`
                : `呜...失败了: ${result.summary}`,
            })
            charStore.setEmotions(result.success ? { joy: 0.6 } : { concern: 0.5 })
          } catch (err) {
            console.warn('[Niromi] Skill steps error:', err)
            chatStore.addMessage({
              role: 'assistant',
              content: humanizeError(err, useConfigStore.getState().language),
            })
            charStore.setEmotions({ concern: 0.7 })
          }
          return
        }
      }

      // Handle tool match
      if (localMatch.tool) {
        const tool = toolRegistry.get(localMatch.tool)
        if (tool) {
          if (tool.riskLevel === 'high') {
            const lang = useConfigStore.getState().language
            chatStore.setPendingConfirm({
              toolName: localMatch.tool,
              params: localMatch.params,
              riskLevel: tool.riskLevel,
              description: describeToolAction(localMatch.tool, localMatch.params, lang),
              onConfirm: async () => {
                chatStore.setPendingConfirm(null)
                try {
                  const result = await toolRegistry.execute(localMatch.tool!, localMatch.params)
                  chatStore.addMessage({
                    role: 'assistant',
                    content: result.success
                      ? `✨ ${result.summary}`
                      : `呜...失败了: ${result.summary}`,
                  })
                  charStore.setEmotions(result.success ? { joy: 0.6 } : { concern: 0.5 })
                } catch (err) {
                  console.warn('[Niromi] Tool confirm exec error:', err)
                  chatStore.addMessage({
                    role: 'assistant',
                    content: humanizeError(err, useConfigStore.getState().language),
                  })
                  charStore.setEmotions({ concern: 0.7 })
                }
              },
              onCancel: () => {
                chatStore.setPendingConfirm(null)
                chatStore.addMessage({
                  role: 'assistant',
                  content: msg('ai.cancelled'),
                })
              },
            })
            return
          }

          try {
            const result = await toolRegistry.execute(localMatch.tool, localMatch.params)

            // Check if tool returned an image (e.g. describe_screen)
            const imageUrl = (result.data as Record<string, unknown>)?._image as string | undefined
            if (imageUrl && result.success) {
              // Screenshot captured locally (zero tokens). Now send to AI for description.
              const provider = createProvider()
              if (!provider) {
                chatStore.addMessage({ role: 'assistant', content: msg('ai.noApiKey') })
                charStore.setEmotions({ concern: 0.4 })
                return
              }

              const lang = useConfigStore.getState().language
              const prompt = lang === 'en'
                ? 'Describe what you see on this screen briefly.'
                : '简要描述一下你在屏幕上看到的内容。'

              const imageMessages: AIMessage[] = [
                { role: 'user', content: prompt, images: [imageUrl] },
              ]

              const visionAssistantId = chatStore.addMessage({ role: 'assistant', content: '' })
              const controller = new AbortController()
              abortRef.current?.abort()
              abortRef.current = controller

              try {
                let responseText = ''
                for await (const chunk of provider.streamChat(imageMessages, undefined, controller.signal)) {
                  if (chunk.type === 'text') {
                    responseText += chunk.text
                    useChatStore.getState().appendToLastMessage(chunk.text)
                  } else if (chunk.type === 'error') {
                    useChatStore.getState().updateMessage(visionAssistantId, {
                      content: humanizeError(chunk.error, useConfigStore.getState().language),
                    })
                    charStore.setEmotions({ concern: 0.7 })
                    return
                  }
                }
                charStore.setEmotions({ joy: 0.6 })
                playSound('reply')

                // Cost tracking
                const { provider: provName, model } = useConfigStore.getState()
                const inputTokens = estimateTokens(prompt) + 200 // image tokens estimate
                const outputTokens = estimateTokens(responseText)
                useCostStore.getState().addUsage(inputTokens, outputTokens, provName, model)

                if (useConfigStore.getState().ttsEnabled && responseText.length > 0 && responseText.length < 500) {
                  speakText(responseText)
                }
              } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                  useChatStore.getState().appendToLastMessage('\n(已中断)')
                } else {
                  useChatStore.getState().updateMessage(visionAssistantId, {
                    content: humanizeError(err, useConfigStore.getState().language),
                  })
                }
              } finally {
                if (abortRef.current === controller) abortRef.current = null
              }
              return
            }

            chatStore.addMessage({
              role: 'assistant',
              content: result.success
                ? `✨ ${result.summary}`
                : `呜...失败了: ${result.summary}`,
            })
            charStore.setEmotions(result.success ? { joy: 0.6 } : { concern: 0.5 })
          } catch (err) {
            console.warn('[Niromi] Tool exec error:', err)
            chatStore.addMessage({
              role: 'assistant',
              content: humanizeError(err, useConfigStore.getState().language),
            })
            charStore.setEmotions({ concern: 0.7 })
          }
          return
        }
      }
    }

    // Step 2: Fall through to AI
    const provider = createProvider()
    if (!provider) {
      chatStore.addMessage({
        role: 'assistant',
        content: msg('ai.noApiKey'),
      })
      charStore.setEmotions({ concern: 0.5 })
      return
    }

    // Token budget config
    const tokenBudget = useConfigStore.getState().tokenBudget
    const pruneLimit = tokenBudget === 'minimal' ? 3000 : tokenBudget === 'smart' ? 6000 : 4000
    const isSimpleMessage = text.length < 100 && !/打开|文件|搜索|搜|查|删除|创建|执行|天气|新闻|翻译|看|屏幕|窗口|截图|视觉|open|file|search|delete|create|run|list|move|weather|translate|news|screen|window|see|look|vision/i.test(text)

    // Get screen context — use vision if enabled, otherwise active window title
    const visionContext = await getVisionContext()
    const screenContext = visionContext || await getScreenContext()

    // Build message history with memory injection (async for FTS5 fact search)
    const maxEpisodes = tokenBudget === 'smart' ? 10 : undefined
    const memoryContext = await injectMemory(screenContext, text, maxEpisodes)

    // Build tool defs including AI-invocable skills (minimal mode skips for simple messages)
    const toolDefs = tokenBudget === 'minimal' && isSimpleMessage ? [] : toolRegistry.getToolDefs()
    const skillDefs = skillRegistry.getAll()
      .filter((s) => s.aiInvocable && (s.steps || s.execute))
      .map((s) => ({
        name: `skill_${s.id}`,
        description: s.description,
        parameters: { type: 'object', properties: { input: { type: 'string', description: 'User request context' } } },
      }))
    const allDefs = [...toolDefs, ...skillDefs]

    // Create AbortController for this request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Conversation messages for multi-round tool use (AI-level messages with tool data)
    const conversationMessages: AIMessage[] = []

    if (memoryContext) {
      conversationMessages.push({ role: 'system', content: memoryContext })
    }

    conversationMessages.push(
      ...useChatStore.getState().messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    )

    // Create initial assistant message placeholder
    let assistantId = chatStore.addMessage({ role: 'assistant', content: '' })

    // Track tool calls for loop detection (same key OR alternating pattern)
    let lastToolKey = ''
    let sameToolCount = 0
    const recentToolKeys: string[] = []

    try {
      let round = 0
      while (round < MAX_TOOL_ROUNDS) {
        if (controller.signal.aborted) break

        // Prune to fit token budget
        const systemTokens = estimateTokens(buildSystemPrompt()) + estimateTokens(JSON.stringify(allDefs))
        const prunedMessages = pruneMessages(conversationMessages, pruneLimit - systemTokens)

        // Collect this round's text and tool calls
        let roundText = ''
        const roundToolCalls: ToolCallRequest[] = []

        for await (const chunk of provider.streamChat(prunedMessages, allDefs.length > 0 ? allDefs : undefined, controller.signal)) {
          switch (chunk.type) {
            case 'text':
              roundText += chunk.text
              useChatStore.getState().appendToLastMessage(chunk.text)
              break

            case 'tool_use':
              roundToolCalls.push({ id: chunk.id, name: chunk.name, input: chunk.input })
              // Add tool call badge to UI
              useChatStore.getState().addToolCallToMessage(assistantId, {
                id: chunk.id,
                name: chunk.name,
                input: chunk.input,
                status: 'pending',
              })
              break

            case 'error':
              useChatStore.getState().updateMessage(assistantId, {
                content: humanizeError(chunk.error, useConfigStore.getState().language),
              })
              charStore.setEmotions({ concern: 0.7 })
              playSound('alert')
              return

            case 'done':
              break
          }
        }

        // No tool calls → AI finished with text response
        if (roundToolCalls.length === 0) {
          charStore.setEmotions({ joy: 0.6 })
          playSound('reply')
          extractFromConversation(useChatStore.getState().messages)

          // Cost tracking
          const { provider, model } = useConfigStore.getState()
          const inputTokens = prunedMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
          const outputTokens = estimateTokens(roundText)
          useCostStore.getState().addUsage(inputTokens, outputTokens, provider, model)

          // TTS for short responses
          if (useConfigStore.getState().ttsEnabled && roundText.length > 0 && roundText.length < 500) {
            speakText(roundText)
          }

          break
        }

        // Loop detection: same tool+params called twice in a row, or alternating pattern
        const toolKey = roundToolCalls.map((tc) => `${tc.name}:${JSON.stringify(tc.input)}`).join('|')
        recentToolKeys.push(toolKey)
        if (recentToolKeys.length > 10) recentToolKeys.shift()
        if (toolKey === lastToolKey) {
          sameToolCount++
          if (sameToolCount >= 2) break
        } else {
          sameToolCount = 0
          lastToolKey = toolKey
        }
        // Detect alternating pattern: A,B,A,B → break
        if (recentToolKeys.length >= 4) {
          const len = recentToolKeys.length
          if (recentToolKeys[len - 1] === recentToolKeys[len - 3] &&
              recentToolKeys[len - 2] === recentToolKeys[len - 4]) break
        }

        // Append assistant message (with tool_calls) to conversation
        conversationMessages.push({
          role: 'assistant',
          content: roundText,
          tool_calls: roundToolCalls,
        })

        // Execute each tool call and collect results
        const toolResults: ToolResult[] = []
        let pendingImage: string | undefined
        for (const tc of roundToolCalls) {
          // Check if user aborted before executing next tool
          if (controller.signal.aborted) break

          // Update badge to running
          useChatStore.getState().updateToolCall(assistantId, tc.id, { status: 'running' })

          try {
            // Handle skill calls
            if (tc.name.startsWith('skill_')) {
              const skillId = tc.name.replace('skill_', '')
              const skill = skillRegistry.get(skillId)
              if (skill) {
                const input = (tc.input.input as string) || ''
                let summary = 'done'
                if (skill.execute) {
                  await skill.execute(input)
                } else if (skill.steps) {
                  const result = await executeSkill(skill, input)
                  summary = result.summary
                }
                toolResults.push({ tool_use_id: tc.id, content: summary })
                useChatStore.getState().updateToolCall(assistantId, tc.id, {
                  status: 'done',
                  result: { success: true, data: null, summary },
                })
                continue
              }
            }

            // Regular tool call
            const tool = toolRegistry.get(tc.name)
            if (!tool) {
              toolResults.push({ tool_use_id: tc.id, content: `Unknown tool: ${tc.name}` })
              useChatStore.getState().updateToolCall(assistantId, tc.id, {
                status: 'error',
                result: { success: false, data: null, summary: `Unknown tool: ${tc.name}` },
              })
              continue
            }

            // High-risk tool: ask for confirmation
            if (tool.riskLevel === 'high') {
              const lang = useConfigStore.getState().language
              const confirmPromise = new Promise<boolean>((resolve) => {
                useChatStore.getState().setPendingConfirm({
                  toolName: tc.name,
                  params: tc.input,
                  riskLevel: tool.riskLevel,
                  description: describeToolAction(tc.name, tc.input, lang),
                  onConfirm: () => {
                    useChatStore.getState().setPendingConfirm(null)
                    resolve(true)
                  },
                  onCancel: () => {
                    useChatStore.getState().setPendingConfirm(null)
                    resolve(false)
                  },
                })
              })
              const timeout = new Promise<boolean>((resolve) => setTimeout(() => {
                useChatStore.getState().setPendingConfirm(null)
                resolve(false)
              }, 30000))
              const confirmed = await Promise.race([confirmPromise, timeout])

              if (!confirmed) {
                toolResults.push({ tool_use_id: tc.id, content: 'User cancelled this action.' })
                useChatStore.getState().updateToolCall(assistantId, tc.id, {
                  status: 'error',
                  result: { success: false, data: null, summary: '已取消' },
                })
                continue
              }
            }

            const result = await toolRegistry.execute(tc.name, tc.input)
            const imageUrl = (result.data as Record<string, unknown>)?._image as string | undefined

            if (imageUrl) {
              // Image result: mark for injection into conversation
              toolResults.push({ tool_use_id: tc.id, content: result.summary || '[screenshot]' })
              pendingImage = imageUrl
            } else {
              // Give AI the FULL result content, not just summary
              const fullContent = typeof result.data === 'string'
                ? result.data.slice(0, 4000)
                : JSON.stringify(result.data).slice(0, 4000)
              toolResults.push({
                tool_use_id: tc.id,
                content: result.success ? fullContent : `Error: ${result.summary}`,
              })
            }
            useChatStore.getState().updateToolCall(assistantId, tc.id, {
              status: result.success ? 'done' : 'error',
              result,
            })
            if (result.success) playSound('complete')
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error'
            toolResults.push({ tool_use_id: tc.id, content: `Error: ${errMsg}` })
            useChatStore.getState().updateToolCall(assistantId, tc.id, {
              status: 'error',
              result: { success: false, data: null, summary: errMsg },
            })
          }
        }

        // Append tool results to conversation
        conversationMessages.push({
          role: 'user',
          content: pendingImage ? '请描述这张截图上的内容' : '',
          images: pendingImage ? [pendingImage] : undefined,
          tool_results: toolResults,
        })
        pendingImage = undefined

        // Create new assistant placeholder for next round
        assistantId = useChatStore.getState().addMessage({ role: 'assistant', content: '' })
        round++
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        useChatStore.getState().appendToLastMessage('\n(已中断)')
      } else {
        useChatStore.getState().updateMessage(assistantId, {
          content: humanizeError(err, useConfigStore.getState().language),
        })
        charStore.setEmotions({ concern: 0.7 })
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }

    // Clean orphan empty assistant message (placeholder left from error between creation and streaming)
    const lastMsg = useChatStore.getState().messages.find((m) => m.id === assistantId)
    if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content && (!lastMsg.toolCalls || lastMsg.toolCalls.length === 0)) {
      useChatStore.getState().deleteMessage(assistantId)
    }
    } finally {
      useChatStore.getState().setStreaming(false)
      isProcessingRef.current = false
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { sendMessage, abort }
}
