import { useEffect, useRef } from 'react'
import { useAdminStore } from '@/stores/adminStore'
import { useChatStore } from '@/stores/chatStore'
import { toolRegistry } from '@/core/tools'
import { skillRegistry } from '@/core/skills/registry'
import { executeSkill } from '@/core/skills/executor'

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

  // Check auto-reply rules
  for (const rule of autoReplyRules) {
    if (!rule.enabled) continue
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
    const reply = rule.replyTemplate || '稍等，我马上回来'

    if (rule.requireConfirm) {
      const chatStore = useChatStore.getState()
      chatStore.addMessage({
        role: 'assistant',
        content: `检测到 ${data.app} 消息，要自动回复「${reply}」吗？`,
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
          useChatStore.getState().addMessage({ role: 'assistant', content: '好的，不回复了~' })
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
      content: `已向 ${app} 发送自动回复: ${reply}`,
    })
  } catch {
    useChatStore.getState().addMessage({
      role: 'assistant',
      content: `自动回复发送失败，Miru 不太确定怎么操作 ${app}...`,
    })
  }
}

export function useMonitorStatus(): boolean {
  const monitorRules = useAdminStore((s) => s.monitorRules)
  const autoReplyRules = useAdminStore((s) => s.autoReplyRules)
  return monitorRules.some((r) => r.enabled) || autoReplyRules.some((r) => r.enabled)
}
