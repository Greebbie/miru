/**
 * Vision Monitor Engine — polls target windows via screenshots, detects content changes,
 * and triggers actions based on MonitorRule / AutoReplyRule patterns.
 *
 * Uses LLM Vision for content analysis when screenshots change.
 * Falls back to window title monitoring when provider doesn't support vision.
 *
 * This is a pure module (not a React hook). Call start/stop from useMonitor.
 */

import { VISION_LLM_TIMEOUT_MS, VISION_POLL_DEFAULT_MS, VISION_POLL_MIN_MS } from '@/core/constants'
import { useAdminStore } from '@/stores/adminStore'
import { useChatStore } from '@/stores/chatStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useConfigStore } from '@/stores/configStore'
import { toolRegistry } from '@/core/tools'
import { skillRegistry } from '@/core/skills/registry'
import { executeSkill } from '@/core/skills/executor'
import { createProvider, isVisionCapable } from '@/core/ai/createProvider'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { useCommandQueueStore } from '@/stores/commandQueueStore'
import { t } from '@/i18n/useI18n'

/** Extraction strategy determines how screenshot content is analyzed */
export type ExtractionStrategy = 'chat' | 'terminal' | 'generic'

/** Detect the best extraction strategy based on window/app name */
function detectStrategy(windowName: string): ExtractionStrategy {
  const lower = windowName.toLowerCase()
  // Chat apps
  if (/wechat|微信|discord|telegram|slack|teams|dingtalk|钉钉|feishu|飞书/.test(lower)) {
    return 'chat'
  }
  // Terminal apps
  if (/cmd|powershell|terminal|iterm|warp|git bash|windowsterminal|mintty|conemu/.test(lower)) {
    return 'terminal'
  }
  return 'generic'
}

/** Get the LLM prompt for a given extraction strategy */
function getStrategyPrompt(strategy: ExtractionStrategy): string {
  switch (strategy) {
    case 'chat':
      return '这是一个聊天窗口截图。提取最新消息的发送者和内容。如果有未读标记（红点）说明是新消息。返回JSON格式: {"messages": [{"sender": "名字", "content": "消息内容", "isNew": true/false}]}'
    case 'terminal':
      return '这是一个终端窗口截图。提取最后几行输出，判断状态。返回JSON格式: {"lastLines": "最后几行输出", "status": "running|completed|error|waiting_input", "errorMessage": "如果有错误的话"}'
    case 'generic':
    default:
      return '简要描述屏幕上的内容变化，只输出关键信息，不超过100字。'
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null
const lastScreenshots = new Map<string, string>()
const ruleCooldowns = new Map<string, number>()
/** Track reply counts per contact per rule */
const replyCounters = new Map<string, number>()

export function isVisionMonitorRunning(): boolean {
  return intervalId !== null
}

export function startVisionMonitor(): void {
  if (intervalId !== null) return

  // Determine minimum interval from all content_change rules
  const minInterval = getMinInterval()
  const pollMs = Math.max(minInterval, VISION_POLL_MIN_MS)

  const chatStore = useChatStore.getState()
  chatStore.addMessage({
    role: 'assistant',
    content: t('monitor.visionStarted'),
  })

  intervalId = setInterval(pollVision, pollMs)

  // Set character to monitoring state
  useCharacterStore.getState().setEmotions({ focus: 0.6 })
}

export function stopVisionMonitor(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    lastScreenshots.clear()
    ruleCooldowns.clear()
    replyCounters.clear()
  }
}

// --- Internal ---

function getMinInterval(): number {
  const { monitorRules, autoReplyRules } = useAdminStore.getState()

  let min = VISION_POLL_DEFAULT_MS
  for (const rule of monitorRules) {
    if (rule.enabled && rule.trigger.type === 'content_change') {
      const iv = rule.trigger.visionIntervalMs ?? VISION_POLL_DEFAULT_MS
      if (iv < min) min = iv
    }
  }
  // AutoReply rules with triggerKeywords also need vision polling
  for (const rule of autoReplyRules) {
    if (rule.enabled && rule.triggerKeywords?.length) {
      min = Math.min(min, VISION_POLL_DEFAULT_MS)
    }
  }
  return min
}

async function pollVision() {
  if (!window.electronAPI) return

  const { monitorRules, autoReplyRules, updateMonitorRule } = useAdminStore.getState()

  // Collect all vision rules
  const contentRules = monitorRules.filter(r => r.enabled && r.trigger.type === 'content_change')
  const keywordAutoReplies = autoReplyRules.filter(r => r.enabled && r.triggerKeywords?.length)

  if (contentRules.length === 0 && keywordAutoReplies.length === 0) return

  // Group by target window
  const windowGroups = new Map<string, typeof contentRules>()
  for (const rule of contentRules) {
    const win = rule.trigger.app || '__fullscreen__'
    const group = windowGroups.get(win) || []
    group.push(rule)
    windowGroups.set(win, group)
  }

  // Auto-reply rules use their app field as window target
  for (const rule of keywordAutoReplies) {
    const win = rule.app || '__fullscreen__'
    if (!windowGroups.has(win)) {
      windowGroups.set(win, [])
    }
  }

  // Poll each target window
  for (const [windowName, rules] of windowGroups) {
    try {
      // Capture screenshot
      const screenshot = windowName === '__fullscreen__'
        ? await window.electronAPI.captureScreenshot()
        : await window.electronAPI.captureWindow(windowName)

      const prevScreenshot = lastScreenshots.get(windowName) || ''

      // Base64 comparison — no change means 0 tokens
      if (screenshot === prevScreenshot) continue

      lastScreenshots.set(windowName, screenshot)

      // Skip first run — don't trigger on initial snapshot
      if (!prevScreenshot) continue

      // Determine content description for keyword matching
      let contentDescription = ''

      // Check if any rules need content analysis (keyword matching)
      const needsContentAnalysis = rules.some(r => r.trigger.pattern !== '.*') ||
        keywordAutoReplies.some(r => (r.app || '__fullscreen__') === windowName)

      if (needsContentAnalysis) {
        // Layered extraction: OCR first (zero token) → LLM Vision fallback
        contentDescription = await extractInfo(screenshot, windowName)
      }

      // Check content_change monitor rules
      for (const rule of rules) {
        if (!checkCooldown(rule.id, rule.cooldownMs)) continue

        // Evaluate conditions if present
        if (rule.conditions) {
          if (!contentDescription && needsContentAnalysis) continue
          if (!evaluateConditions(contentDescription, rule.conditions)) continue
        } else if (rule.trigger.pattern !== '.*') {
          // Legacy pattern matching
          if (!contentDescription) continue
          try {
            const matched = new RegExp(rule.trigger.pattern, 'i').test(contentDescription)
            if (!matched) continue
          } catch {
            if (!contentDescription.toLowerCase().includes(rule.trigger.pattern.toLowerCase())) continue
          }
        }
        // If pattern is '.*' and no conditions, any change triggers

        ruleCooldowns.set(rule.id, Date.now())
        updateMonitorRule(rule.id, { lastTriggered: Date.now() })
        await executeVisionAction(rule.action, { app: windowName, title: contentDescription.slice(0, 100) })
      }

      // Check keyword auto-reply rules for this window
      if (contentDescription) {
        const matchingARRules = keywordAutoReplies.filter(r => {
          const ruleWin = r.app || '__fullscreen__'
          return ruleWin === windowName
        })
        const adminStore = useAdminStore.getState()
        for (const rule of matchingARRules) {
          if (!checkCooldown(`ar_${rule.id}`, 30000)) {
            adminStore.addDelegationLog({
              timestamp: Date.now(),
              app: rule.app,
              action: 'skipped_cooldown',
            })
            continue
          }

          const keywords = rule.triggerKeywords || []
          const matched = keywords.some(kw => contentDescription.toLowerCase().includes(kw.toLowerCase()))
          if (!matched) continue

          // Layer 1: Sensitive keyword filtering
          const sensitiveKw = rule.sensitiveKeywords?.find(kw =>
            contentDescription.toLowerCase().includes(kw.toLowerCase())
          )
          if (sensitiveKw) {
            adminStore.addDelegationLog({
              timestamp: Date.now(),
              app: rule.app,
              action: 'skipped_sensitive',
              sensitiveKeyword: sensitiveKw,
            })
            continue
          }

          // Max replies per contact check
          if (rule.maxRepliesPerContact) {
            const counterKey = `${rule.id}_${windowName}`
            const count = replyCounters.get(counterKey) || 0
            if (count >= rule.maxRepliesPerContact) {
              adminStore.addDelegationLog({
                timestamp: Date.now(),
                app: rule.app,
                action: 'skipped_max_replies',
              })
              continue
            }
            replyCounters.set(counterKey, count + 1)
          }

          ruleCooldowns.set(`ar_${rule.id}`, Date.now())

          let reply: string
          if (rule.useAI) {
            // Layer 2: AI instruction injection for sensitive topics
            reply = await generateAIReply(contentDescription, rule.sensitiveInstruction)
          } else {
            reply = rule.replyTemplate || t('monitor.autoReplyDefault')
          }

          await sendAutoReply(rule.app, reply)
          adminStore.addDelegationLog({
            timestamp: Date.now(),
            app: rule.app,
            action: 'replied',
            replySent: reply,
          })
        }
      }
    } catch {
      // Skip this window on error, try next
    }
  }
}

/**
 * Extract content from screenshot using layered approach:
 * 1. Try OCR first (zero LLM cost)
 * 2. Fall back to LLM Vision if OCR fails or is insufficient
 */
async function extractInfo(
  screenshotDataUrl: string,
  windowName: string,
  customPrompt?: string
): Promise<string> {
  // Layer 1: Try OCR first (zero token cost)
  try {
    if (window.electronAPI?.ocrImage) {
      const ocrText = await window.electronAPI.ocrImage(screenshotDataUrl)
      if (ocrText && ocrText.length > 10) {
        return ocrText
      }
    }
  } catch {
    // OCR failed, fall back to LLM
  }

  // Layer 2: LLM Vision (with 15s timeout to prevent stalling)
  try {
    const provider = createProvider('vision')
    if (!provider) return ''

    const strategy = detectStrategy(windowName)
    const prompt = customPrompt || getStrategyPrompt(strategy)

    let description = ''
    const streamPromise = (async () => {
      for await (const chunk of provider.streamChat([
        { role: 'system', content: prompt },
        { role: 'user', content: [
          { type: 'image', source: screenshotDataUrl },
          { type: 'text', text: '分析内容' },
        ] as any },
      ])) {
        if (chunk.type === 'text') description += chunk.text
      }
    })()

    await Promise.race([
      streamPromise,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), VISION_LLM_TIMEOUT_MS)),
    ])
    return description
  } catch {
    return ''
  }
}

/** Evaluate conditions against extracted content text */
function evaluateConditions(
  text: string,
  conditions: { contains?: string[]; notContains?: string[]; matchPattern?: string; stateChange?: string }
): boolean {
  const lower = text.toLowerCase()

  // contains: text must include at least one keyword
  if (conditions.contains?.length) {
    const hasAny = conditions.contains.some((kw) => lower.includes(kw.toLowerCase()))
    if (!hasAny) return false
  }

  // notContains: text must NOT include any of these
  if (conditions.notContains?.length) {
    const hasAny = conditions.notContains.some((kw) => lower.includes(kw.toLowerCase()))
    if (hasAny) return false
  }

  // matchPattern: regex match
  if (conditions.matchPattern) {
    try {
      if (!new RegExp(conditions.matchPattern, 'i').test(text)) return false
    } catch {
      if (!lower.includes(conditions.matchPattern.toLowerCase())) return false
    }
  }

  // stateChange: detect specific state transitions
  if (conditions.stateChange === 'error_detected') {
    const errorPatterns = /error|failed|exception|panic|stack trace|traceback/i
    if (!errorPatterns.test(text)) return false
  }

  return true
}

function checkCooldown(id: string, cooldownMs: number): boolean {
  const last = ruleCooldowns.get(id)
  if (!last) return true
  return Date.now() - last >= cooldownMs
}

async function executeVisionAction(
  action: { type: string; payload: string; params?: Record<string, unknown> },
  data: { app: string; title: string }
) {
  const chatStore = useChatStore.getState()

  switch (action.type) {
    case 'notify': {
      const notifyMsg = action.payload.replace('{app}', data.app).replace('{title}', data.title)
      chatStore.addMessage({ role: 'assistant', content: notifyMsg })
      chatStore.openChat()
      // Also send native OS notification (works when minimized)
      useFeedbackStore.getState().notifyNative('Niromi', notifyMsg)
      // Alert character expression
      useCharacterStore.getState().setEmotions({ curiosity: 0.7 })
      break
    }

    case 'run_tool':
      try {
        await toolRegistry.execute(action.payload, action.params || {})
      } catch { /* logged by registry */ }
      break

    case 'run_skill': {
      const skill = skillRegistry.get(action.payload)
      if (skill?.execute) {
        await skill.execute('')
      } else if (skill?.steps) {
        await executeSkill(skill, '')
      }
      break
    }

    case 'send_keys_to_app': {
      try {
        const targetApp = data.app === '__fullscreen__' ? '' : data.app
        if (targetApp) {
          await window.electronAPI?.focusWindow(targetApp)
          await new Promise(r => setTimeout(r, 500))
        }
        await window.electronAPI?.sendKeys(action.payload)
        chatStore.addMessage({
          role: 'assistant',
          content: t('monitor.keysSent').replace('{app}', targetApp || 'active window').replace('{keys}', action.payload),
        })
      } catch {
        chatStore.addMessage({
          role: 'assistant',
          content: t('monitor.keysFailed'),
        })
      }
      break
    }

    case 'copy_content':
      if (data.title) {
        await window.electronAPI?.clipboardWrite(data.title)
        useFeedbackStore.getState().addToast({
          icon: '\uD83D\uDCCB',
          message: '已复制检测内容到剪贴板',
          type: 'info',
        })
      }
      break

    case 'run_command': {
      try {
        const targetApp = data.app === '__fullscreen__' ? '' : data.app
        if (targetApp) {
          await window.electronAPI?.focusWindow(targetApp)
          await new Promise(r => setTimeout(r, 500))
        }
        await window.electronAPI?.sendKeys(action.payload + '{ENTER}')
        chatStore.addMessage({
          role: 'assistant',
          content: `已在 ${targetApp || '活动窗口'} 执行: ${action.payload}`,
        })
      } catch {
        chatStore.addMessage({
          role: 'assistant',
          content: '命令执行失败',
        })
      }
      break
    }

    case 'chain_next': {
      const queueStore = useCommandQueueStore.getState()
      const ruleId = action.payload // payload is the ruleId for the queue
      const nextCmd = queueStore.popNext(ruleId)
      if (nextCmd) {
        const targetApp = data.app === '__fullscreen__' ? '' : data.app
        if (targetApp) {
          await window.electronAPI?.focusWindow(targetApp)
          await new Promise(r => setTimeout(r, 500))
        }
        await window.electronAPI?.sendKeys(nextCmd + '{ENTER}')
        chatStore.addMessage({
          role: 'assistant',
          content: `队列执行: ${nextCmd}`,
        })
      } else if (queueStore.isDone(ruleId)) {
        chatStore.addMessage({
          role: 'assistant',
          content: '所有队列任务已完成！',
        })
        chatStore.openChat()
        useFeedbackStore.getState().addToast({
          icon: '\u2705',
          message: '所有任务完成',
          type: 'success',
        })
      }
      break
    }
  }
}

async function generateAIReply(context: string, sensitiveInstruction?: string): Promise<string> {
  const fallback = t('monitor.autoReplyDefault')
  try {
    const provider = createProvider('monitoring')
    if (!provider) return fallback

    let systemPrompt = t('monitor.aiSystemPrompt')
    if (sensitiveInstruction) {
      systemPrompt += `\n\n重要：${sensitiveInstruction}`
    }

    let reply = ''
    for await (const chunk of provider.streamChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: t('monitor.aiUserPrompt').replace('{context}', context.slice(0, 500)) },
    ])) {
      if (chunk.type === 'text') reply += chunk.text
    }
    return reply || fallback
  } catch {
    return fallback
  }
}

async function sendAutoReply(app: string, reply: string) {
  try {
    await window.electronAPI?.clipboardWrite(reply)
    await window.electronAPI?.focusWindow(app)
    await new Promise(r => setTimeout(r, 300))
    await window.electronAPI?.sendKeys('^v{ENTER}')
    useChatStore.getState().addMessage({
      role: 'assistant',
      content: t('monitor.autoReplySent').replace('{app}', app).replace('{reply}', reply),
    })
  } catch {
    useChatStore.getState().addMessage({
      role: 'assistant',
      content: t('monitor.autoReplyFailed').replace('{app}', app),
    })
  }
}
