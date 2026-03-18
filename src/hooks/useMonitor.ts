import { useEffect, useRef } from 'react'
import { useAdminStore } from '@/stores/adminStore'
import { useChatStore } from '@/stores/chatStore'
import { toolRegistry } from '@/core/tools'
import { skillRegistry } from '@/core/skills/registry'
import { executeSkill } from '@/core/skills/executor'
import { startVisionMonitor, stopVisionMonitor, isVisionMonitorRunning } from './useVisionMonitor'
import { t } from '@/i18n/useI18n'

const APP_ALIASES: Record<string, string[]> = {
  wechat: ['wechat', 'weixin', '微信'],
  discord: ['discord'],
  telegram: ['telegram'],
  outlook: ['outlook', 'mail'],
}

function matchTrigger(trigger: { type: string; pattern: string; app?: string }, data: { app: string; title: string }): boolean {
  switch (trigger.type) {
    case 'app_focus':
      return data.app.toLowerCase().includes(trigger.pattern.toLowerCase())
    case 'window_title':
      try {
        return new RegExp(trigger.pattern, 'i').test(data.title)
      } catch {
        return data.title.toLowerCase().includes(trigger.pattern.toLowerCase())
      }
    case 'content_change':
      // Handled by vision monitor, not window-change events
      return false
    default:
      return false
  }
}

function matchAutoReplyApp(ruleApp: string, windowApp: string): boolean {
  const aliases = APP_ALIASES[ruleApp] || [ruleApp]
  const lower = windowApp.toLowerCase()
  return aliases.some((a) => lower.includes(a))
}

async function executeAction(
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
        if (data.app) {
          await window.electronAPI?.focusWindow(data.app)
          await new Promise(r => setTimeout(r, 500))
        }
        await window.electronAPI?.sendKeys(action.payload)
        chatStore.addMessage({
          role: 'assistant',
          content: t('monitor.keysSent').replace('{app}', data.app || 'active window').replace('{keys}', action.payload),
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

/** Track last user input time for idle detection */
let lastUserInput = Date.now()

export function markUserActive() {
  lastUserInput = Date.now()
}

/**
 * Handle window change events — always reads fresh state from stores.
 * Defined outside the hook so it's a stable reference.
 */
function handleWindowChanged(data: { app: string; title: string }) {
  const { monitorRules, autoReplyRules, updateMonitorRule } = useAdminStore.getState()

  // Check monitor rules
  for (const rule of monitorRules) {
    if (!rule.enabled) continue
    if (!matchTrigger(rule.trigger, data)) continue

    // Cooldown check
    if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) continue

    // Fire action
    updateMonitorRule(rule.id, { lastTriggered: Date.now() })
    executeAction(rule.action, data)
  }

  // Check auto-reply rules (skip rules with triggerKeywords — handled by vision monitor)
  for (const rule of autoReplyRules) {
    if (!rule.enabled) continue
    if (rule.triggerKeywords?.length) continue
    if (!matchAutoReplyApp(rule.app, data.app)) continue

    // Contact pattern check
    if (rule.contactPattern) {
      try {
        if (!new RegExp(rule.contactPattern, 'i').test(data.title)) continue
      } catch {
        if (!data.title.toLowerCase().includes(rule.contactPattern.toLowerCase())) continue
      }
    }

    // Idle check
    if (rule.idleMinutes && (Date.now() - lastUserInput) < rule.idleMinutes * 60000) continue

    // Generate reply
    const reply = rule.replyTemplate || t('monitor.autoReplyDefault')

    if (rule.requireConfirm) {
      const chatStore = useChatStore.getState()
      chatStore.addMessage({
        role: 'assistant',
        content: t('monitor.autoReplyDetected').replace('{app}', data.app).replace('{reply}', reply),
      })
      chatStore.setPendingConfirm({
        toolName: 'auto_reply',
        params: { app: data.app, reply },
        onConfirm: async () => {
          useChatStore.getState().setPendingConfirm(null)
          await sendAutoReply(data.app, reply)
        },
        onCancel: () => {
          useChatStore.getState().setPendingConfirm(null)
          useChatStore.getState().addMessage({ role: 'assistant', content: t('monitor.autoReplyCancelled') })
        },
      })
      chatStore.openChat()
    } else {
      sendAutoReply(data.app, reply)
    }
  }
}

export function useMonitor() {
  const isRunningRef = useRef(false)

  // Single effect: manage monitor lifecycle based on rule state
  useEffect(() => {
    function checkAndStart() {
      const admin = useAdminStore.getState()
      const hasEnabled = admin.monitorRules.some((r) => r.enabled) || admin.autoReplyRules.some((r) => r.enabled)

      if (hasEnabled && !isRunningRef.current) {
        window.electronAPI?.monitorStart(2000)
        window.electronAPI?.onWindowChanged(handleWindowChanged)
        isRunningRef.current = true
      } else if (!hasEnabled && isRunningRef.current) {
        window.electronAPI?.monitorStop()
        window.electronAPI?.offWindowChanged?.()
        isRunningRef.current = false
      }

      // Vision monitor lifecycle
      const hasVisionRules = admin.monitorRules.some(r => r.enabled && r.trigger.type === 'content_change')
        || admin.autoReplyRules.some(r => r.enabled && r.triggerKeywords?.length)

      if (hasVisionRules && !isVisionMonitorRunning()) {
        startVisionMonitor()
      } else if (!hasVisionRules && isVisionMonitorRunning()) {
        stopVisionMonitor()
      }
    }

    // Initial check
    checkAndStart()

    // Re-check whenever admin store changes
    const unsub = useAdminStore.subscribe(() => checkAndStart())

    return () => {
      unsub()
      if (isRunningRef.current) {
        window.electronAPI?.monitorStop()
        window.electronAPI?.offWindowChanged?.()
        isRunningRef.current = false
      }
      if (isVisionMonitorRunning()) {
        stopVisionMonitor()
      }
    }
  }, [])
}

async function sendAutoReply(app: string, reply: string) {
  try {
    await window.electronAPI?.clipboardWrite(reply)
    await window.electronAPI?.focusWindow(app)
    // Small delay to let window focus
    await new Promise((r) => setTimeout(r, 300))
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

export function useMonitorStatus(): boolean {
  const monitorRules = useAdminStore((s) => s.monitorRules)
  const autoReplyRules = useAdminStore((s) => s.autoReplyRules)
  return monitorRules.some((r) => r.enabled) || autoReplyRules.some((r) => r.enabled)
}
