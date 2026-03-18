/**
 * Vision Monitor Engine — polls target windows via OCR, detects content changes,
 * and triggers actions based on MonitorRule / AutoReplyRule patterns.
 *
 * This is a pure module (not a React hook). Call start/stop from useMonitor.
 */

import { useAdminStore } from '@/stores/adminStore'
import { useChatStore } from '@/stores/chatStore'
import { useConfigStore } from '@/stores/configStore'
import { toolRegistry } from '@/core/tools'
import { skillRegistry } from '@/core/skills/registry'
import { executeSkill } from '@/core/skills/executor'
import { createProvider } from '@/core/ai/createProvider'
import { t } from '@/i18n/useI18n'

let intervalId: ReturnType<typeof setInterval> | null = null
const lastOcrSnapshots = new Map<string, string>()
const ruleCooldowns = new Map<string, number>()

export function isVisionMonitorRunning(): boolean {
  return intervalId !== null
}

export function startVisionMonitor(): void {
  if (intervalId !== null) return

  // Determine minimum interval from all content_change rules
  const minInterval = getMinInterval()
  const pollMs = Math.max(minInterval, 5000) // floor at 5s

  const chatStore = useChatStore.getState()
  chatStore.addMessage({
    role: 'assistant',
    content: t('monitor.visionStarted'),
  })

  // Auto-init vision
  initVisionIfNeeded()

  intervalId = setInterval(pollVision, pollMs)
}

export function stopVisionMonitor(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    lastOcrSnapshots.clear()
    ruleCooldowns.clear()
  }
}

// --- Internal ---

function getMinInterval(): number {
  const { monitorRules, autoReplyRules } = useAdminStore.getState()

  let min = 10000
  for (const rule of monitorRules) {
    if (rule.enabled && rule.trigger.type === 'content_change') {
      const iv = rule.trigger.visionIntervalMs ?? 10000
      if (iv < min) min = iv
    }
  }
  // AutoReply rules with triggerKeywords also need vision polling
  for (const rule of autoReplyRules) {
    if (rule.enabled && rule.triggerKeywords?.length) {
      min = Math.min(min, 10000)
    }
  }
  return min
}

async function initVisionIfNeeded() {
  if (!window.electronAPI) return
  try {
    const status = await window.electronAPI.visionStatus()
    if (!status.initialized) {
      const chatStore = useChatStore.getState()
      chatStore.addMessage({
        role: 'assistant',
        content: t('monitor.visionInitializing'),
      })
      await window.electronAPI.visionInit()
    }
  } catch {
    // Vision init failed — polls will return empty OCR
  }
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
      const result = windowName === '__fullscreen__'
        ? await window.electronAPI.visionAnalyze()
        : await window.electronAPI.visionAnalyzeWindow(windowName)

      const ocrText = result.ocrText || ''
      const prevText = lastOcrSnapshots.get(windowName) || ''
      const newContent = computeNewContent(prevText, ocrText)
      lastOcrSnapshots.set(windowName, ocrText)

      // Skip if no new content (or first run — don't trigger on initial snapshot)
      if (!newContent || !prevText) continue

      // Check content_change monitor rules
      for (const rule of rules) {
        if (!checkCooldown(rule.id, rule.cooldownMs)) continue

        try {
          const matched = rule.trigger.pattern === '.*'
            ? true
            : new RegExp(rule.trigger.pattern, 'i').test(newContent)
          if (!matched) continue
        } catch {
          if (!newContent.toLowerCase().includes(rule.trigger.pattern.toLowerCase())) continue
        }

        ruleCooldowns.set(rule.id, Date.now())
        updateMonitorRule(rule.id, { lastTriggered: Date.now() })
        await executeVisionAction(rule.action, { app: windowName, title: newContent.slice(0, 100) })
      }

      // Check keyword auto-reply rules for this window
      const matchingARRules = keywordAutoReplies.filter(r => {
        const ruleWin = r.app || '__fullscreen__'
        return ruleWin === windowName
      })
      for (const rule of matchingARRules) {
        if (!checkCooldown(`ar_${rule.id}`, 30000)) continue

        const keywords = rule.triggerKeywords || []
        const matched = keywords.some(kw => newContent.toLowerCase().includes(kw.toLowerCase()))
        if (!matched) continue

        ruleCooldowns.set(`ar_${rule.id}`, Date.now())

        let reply: string
        if (rule.useAI) {
          reply = await generateAIReply(newContent)
        } else {
          reply = rule.replyTemplate || t('monitor.autoReplyDefault')
        }

        await sendAutoReply(rule.app, reply)
      }
    } catch {
      // Skip this window on error, try next
    }
  }
}

function computeNewContent(oldText: string, newText: string): string {
  const oldLines = new Set(oldText.split('\n').map(l => l.trim()).filter(Boolean))
  return newText.split('\n')
    .map(l => l.trim())
    .filter(l => l && !oldLines.has(l))
    .join('\n')
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
    case 'notify':
      chatStore.addMessage({
        role: 'assistant',
        content: action.payload.replace('{app}', data.app).replace('{title}', data.title),
      })
      chatStore.openChat()
      break

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
  }
}

async function generateAIReply(context: string): Promise<string> {
  const fallback = t('monitor.autoReplyDefault')
  try {
    const provider = createProvider()
    if (!provider) return fallback

    let reply = ''
    for await (const chunk of provider.streamChat([
      { role: 'system', content: t('monitor.aiSystemPrompt') },
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
