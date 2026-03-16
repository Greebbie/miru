import { useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useConfigStore } from '@/stores/configStore'
import { useCharacterStore } from '@/stores/characterStore'
import type { AIProvider, Message as AIMessage, ToolCallRequest, ToolResult } from '@/core/ai/provider'
import { ClaudeProvider } from '@/core/ai/claude'
import { OpenAIProvider } from '@/core/ai/openai'
import { DeepSeekProvider } from '@/core/ai/deepseek'
import { OllamaProvider } from '@/core/ai/ollama'
import { VLLMProvider } from '@/core/ai/vllm'
import { QwenProvider } from '@/core/ai/qwen'
import { MinimaxProvider } from '@/core/ai/minimax'
import { parseLocal } from '@/core/parser/local'
import { toolRegistry } from '@/core/tools'
import { injectMemory } from '@/core/memory/injector'
import { extractFromConversation } from '@/core/memory/extractor'
import { pruneMessages } from '@/core/ai/tokenBudget'
import { estimateTokens } from '@/core/ai/tokenBudget'
import { buildSystemPrompt } from '@/core/ai/systemPrompt'
import { skillRegistry } from '@/core/skills/registry'
import { executeSkill } from '@/core/skills/executor'
import { useCostStore } from '@/stores/costStore'
import { speakText } from '@/core/tts'

const MAX_TOOL_ROUNDS = 5

function createProvider(): AIProvider | null {
  const { provider, apiKey, model, baseUrl, groupId } = useConfigStore.getState()

  switch (provider) {
    case 'claude':
      return apiKey ? new ClaudeProvider(apiKey, model) : null
    case 'openai':
      return apiKey ? new OpenAIProvider(apiKey, model) : null
    case 'deepseek':
      return apiKey ? new DeepSeekProvider(apiKey, model) : null
    case 'ollama':
      return new OllamaProvider(baseUrl || undefined, model || undefined)
    case 'vllm':
      return new VLLMProvider(baseUrl || undefined, model || undefined)
    case 'qwen':
      return apiKey ? new QwenProvider(apiKey, model || undefined) : null
    case 'minimax':
      return apiKey ? new MinimaxProvider(apiKey, groupId || '', model || undefined) : null
    default:
      return null
  }
}

/**
 * Get active window context with timeout. Returns empty string on failure.
 */
async function getScreenContext(): Promise<string> {
  try {
    const result = await Promise.race([
      window.electronAPI.getActiveWindow(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    if (result) {
      return `${result.app} - ${result.title || '(no title)'}`
    }
  } catch { /* ignore timeout/errors */ }
  return ''
}

/**
 * Get vision context if enabled. Returns empty string if disabled or fails.
 */
async function getVisionContext(): Promise<string> {
  const { visionEnabled } = useConfigStore.getState()
  if (!visionEnabled) return ''

  try {
    const status = await window.electronAPI.visionStatus()
    if (!status.initialized) {
      await window.electronAPI.visionInit()
    }
    const result = await window.electronAPI.visionAnalyze()
    return result.summary || ''
  } catch { /* ignore vision errors */ }
  return ''
}

export function useAI() {
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    const chatStore = useChatStore.getState()
    const charStore = useCharacterStore.getState()

    // Add user message
    chatStore.addMessage({ role: 'user', content: text })
    chatStore.setStreaming(true)
    charStore.setEmotions({ curiosity: 0.8 })

    // Step 1: Try local parser first (zero tokens!)
    const localMatch = parseLocal(text)
    if (localMatch) {
      // Handle skill match
      if (localMatch.skill) {
        const skill = skillRegistry.get(localMatch.skill)
        if (skill?.execute) {
          try {
            await skill.execute(text)
            charStore.setEmotions({ joy: 0.6 })
          } catch {
            chatStore.addMessage({
              role: 'assistant',
              content: '哎呀，执行的时候出了点问题...',
            })
            charStore.setEmotions({ concern: 0.7 })
          }
          chatStore.setStreaming(false)
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
          } catch {
            chatStore.addMessage({
              role: 'assistant',
              content: '哎呀，执行的时候出了点问题...',
            })
            charStore.setEmotions({ concern: 0.7 })
          }
          chatStore.setStreaming(false)
          return
        }
      }

      // Handle tool match
      if (localMatch.tool) {
        const tool = toolRegistry.get(localMatch.tool)
        if (tool) {
          if (tool.riskLevel === 'high') {
            chatStore.setPendingConfirm({
              toolName: localMatch.tool,
              params: localMatch.params,
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
                } catch {
                  chatStore.addMessage({
                    role: 'assistant',
                    content: '哎呀，执行的时候出了点问题...',
                  })
                  charStore.setEmotions({ concern: 0.7 })
                }
              },
              onCancel: () => {
                chatStore.setPendingConfirm(null)
                chatStore.addMessage({
                  role: 'assistant',
                  content: '好的，已取消~',
                })
              },
            })
            chatStore.setStreaming(false)
            return
          }

          try {
            const result = await toolRegistry.execute(localMatch.tool, localMatch.params)
            chatStore.addMessage({
              role: 'assistant',
              content: result.success
                ? `✨ ${result.summary}`
                : `呜...失败了: ${result.summary}`,
            })
            charStore.setEmotions(result.success ? { joy: 0.6 } : { concern: 0.5 })
          } catch {
            chatStore.addMessage({
              role: 'assistant',
              content: '哎呀，执行的时候出了点问题...',
            })
            charStore.setEmotions({ concern: 0.7 })
          }
          chatStore.setStreaming(false)
          return
        }
      }
    }

    // Step 2: Fall through to AI
    const provider = createProvider()
    if (!provider) {
      chatStore.addMessage({
        role: 'assistant',
        content: 'Miru 还没有配置 API Key 呢~ 去设置里填一下吧！',
      })
      chatStore.setStreaming(false)
      charStore.setEmotions({ concern: 0.5 })
      return
    }

    // Get screen context — use vision if enabled, otherwise active window title
    const visionContext = await getVisionContext()
    const screenContext = visionContext || await getScreenContext()

    // Build message history with memory injection (async for FTS5 fact search)
    const memoryContext = await injectMemory(screenContext, text)

    // Build tool defs including AI-invocable skills
    const toolDefs = toolRegistry.getToolDefs()
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
        const systemTokens = estimateTokens(buildSystemPrompt()) + 200
        const prunedMessages = pruneMessages(conversationMessages, 4000 - systemTokens)

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
                content: `哎呀，Miru 遇到了一点小问题... (${chunk.error.slice(0, 100)})`,
              })
              charStore.setEmotions({ concern: 0.7 })
              return

            case 'done':
              break
          }
        }

        // No tool calls → AI finished with text response
        if (roundToolCalls.length === 0) {
          charStore.setEmotions({ joy: 0.6 })
          extractFromConversation(useChatStore.getState().messages)

          // Cost tracking
          const { provider, model } = useConfigStore.getState()
          const inputTokens = prunedMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
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
        for (const tc of roundToolCalls) {
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
              const confirmed = await new Promise<boolean>((resolve) => {
                useChatStore.getState().setPendingConfirm({
                  toolName: tc.name,
                  params: tc.input,
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
            // Give AI the FULL result content, not just summary
            const fullContent = typeof result.data === 'string'
              ? result.data.slice(0, 4000)
              : JSON.stringify(result.data).slice(0, 4000)
            toolResults.push({
              tool_use_id: tc.id,
              content: result.success ? fullContent : `Error: ${result.summary}`,
            })
            useChatStore.getState().updateToolCall(assistantId, tc.id, {
              status: result.success ? 'done' : 'error',
              result,
            })
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
          content: '',
          tool_results: toolResults,
        })

        // Create new assistant placeholder for next round
        assistantId = useChatStore.getState().addMessage({ role: 'assistant', content: '' })
        round++
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        useChatStore.getState().appendToLastMessage('\n(已中断)')
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        useChatStore.getState().updateMessage(assistantId, {
          content: `呜...连接出了问题，Miru 等一下再试试？ (${errorMsg.slice(0, 80)})`,
        })
        charStore.setEmotions({ concern: 0.7 })
      }
    } finally {
      useChatStore.getState().setStreaming(false)
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { sendMessage, abort }
}
