import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAdminStore } from '@/stores/adminStore'
import { useChatStore } from '@/stores/chatStore'
import {
  startVisionMonitor,
  stopVisionMonitor,
  isVisionMonitorRunning,
} from '@/hooks/useVisionMonitor'

// Mock modules that useVisionMonitor imports but we don't need for these tests
vi.mock('@/core/tools', () => ({
  toolRegistry: { execute: vi.fn().mockResolvedValue({ success: true }) },
}))

vi.mock('@/core/skills/registry', () => ({
  skillRegistry: { get: vi.fn().mockReturnValue(null) },
}))

vi.mock('@/core/skills/executor', () => ({
  executeSkill: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/core/ai/createProvider', () => ({
  createProvider: vi.fn().mockReturnValue(null),
  isVisionCapable: vi.fn().mockReturnValue(false),
}))

vi.mock('@/i18n/useI18n', () => ({
  t: (key: string) => key,
}))

/** Polling interval used by all test rules (must be >= 60000, the module floor) */
const POLL_MS = 60_000

function makeMonitorRule(overrides?: {
  id?: string
  trigger?: Partial<{ type: 'app_focus' | 'window_title' | 'content_change'; pattern: string; app: string; visionIntervalMs: number }>
  action?: Partial<{ type: 'notify' | 'auto_reply' | 'run_tool' | 'run_skill' | 'send_keys_to_app'; payload: string; params?: Record<string, unknown> }>
  cooldownMs?: number
  enabled?: boolean
}) {
  return {
    id: overrides?.id ?? 'rule-1',
    name: 'Test Rule',
    enabled: overrides?.enabled ?? true,
    trigger: {
      type: 'content_change' as const,
      pattern: 'error',
      app: '',
      visionIntervalMs: POLL_MS,
      ...overrides?.trigger,
    },
    action: {
      type: 'notify' as const,
      payload: 'Detected: {title}',
      ...overrides?.action,
    },
    cooldownMs: overrides?.cooldownMs ?? 1000,
  }
}

/** Advance fake timers and flush all pending microtasks (promises) */
async function advanceAndFlush(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

/** Counter for generating unique screenshot data URLs */
let screenshotCounter = 0

describe('useVisionMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    screenshotCounter = 0

    // Reset stores to clean state
    useChatStore.setState({ messages: [] })
    useAdminStore.setState({
      monitorRules: [],
      autoReplyRules: [],
    })

    // Reset electronAPI mocks — now uses captureScreenshot/captureWindow instead of visionAnalyze
    const api = window.electronAPI!
    vi.mocked(api.captureScreenshot).mockImplementation(async () => {
      screenshotCounter++
      return `data:image/jpeg;base64,screenshot_${screenshotCounter}`
    })
    vi.mocked(api.captureWindow).mockImplementation(async () => {
      screenshotCounter++
      return `data:image/jpeg;base64,window_${screenshotCounter}`
    })
    vi.mocked(api.getActiveWindow).mockResolvedValue({ app: 'Test', title: 'test window' })
    vi.mocked(api.clipboardWrite).mockClear()
    vi.mocked(api.focusWindow).mockClear()
    vi.mocked(api.sendKeys).mockClear()
  })

  afterEach(() => {
    stopVisionMonitor()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ---- Lifecycle ----

  describe('startVisionMonitor / stopVisionMonitor lifecycle', () => {
    it('sets up interval and adds chat message on start', () => {
      useAdminStore.setState({
        monitorRules: [makeMonitorRule()],
      })

      startVisionMonitor()

      expect(isVisionMonitorRunning()).toBe(true)

      const messages = useChatStore.getState().messages
      const startMsg = messages.find(m => m.content === 'monitor.visionStarted')
      expect(startMsg).toBeDefined()
      expect(startMsg!.role).toBe('assistant')
    })

    it('stopVisionMonitor clears interval and snapshots', () => {
      useAdminStore.setState({
        monitorRules: [makeMonitorRule()],
      })

      startVisionMonitor()
      expect(isVisionMonitorRunning()).toBe(true)

      stopVisionMonitor()
      expect(isVisionMonitorRunning()).toBe(false)
    })

    it('starting when already running does nothing (no duplicate intervals)', () => {
      useAdminStore.setState({
        monitorRules: [makeMonitorRule()],
      })

      startVisionMonitor()
      const messageCountAfterFirst = useChatStore.getState().messages.length

      // Starting again should be a no-op
      startVisionMonitor()
      const messageCountAfterSecond = useChatStore.getState().messages.length

      expect(messageCountAfterSecond).toBe(messageCountAfterFirst)
      expect(isVisionMonitorRunning()).toBe(true)
    })
  })

  // ---- Screenshot-based change detection ----

  describe('screenshot change detection', () => {
    it('no action triggered when screenshots are identical', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      // Return same screenshot every time
      vi.mocked(api.captureScreenshot).mockResolvedValue('data:image/jpeg;base64,same')

      startVisionMonitor()

      // First poll — sets initial snapshot, no trigger
      await advanceAndFlush(POLL_MS)

      // Second poll — same screenshot, no change
      await advanceAndFlush(POLL_MS)

      // Verify no notify message was added (beyond the initial start message)
      const messages = useChatStore.getState().messages
      const notifyMessages = messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages).toHaveLength(0)
    })

    it('wildcard pattern .* triggers on any screenshot change', async () => {
      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      // Each call returns unique screenshot (via counter in beforeEach)
      startVisionMonitor()

      // First poll — initial snapshot
      await advanceAndFlush(POLL_MS)

      // Second poll — different screenshot triggers action
      await advanceAndFlush(POLL_MS)

      const messages = useChatStore.getState().messages
      const notifyMessages = messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })
  })

  // ---- Cooldown behavior ----

  describe('checkCooldown behavior', () => {
    it('a rule that just fired should not fire again within cooldown', async () => {
      useAdminStore.setState({
        monitorRules: [makeMonitorRule({
          cooldownMs: 180000, // 3 minutes cooldown (longer than poll interval)
          trigger: { pattern: '.*' },
        })],
      })

      startVisionMonitor()

      // First poll — initial snapshot
      await advanceAndFlush(POLL_MS)

      // Second poll — triggers rule (first real change)
      await advanceAndFlush(POLL_MS)

      const messagesAfterFirst = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(messagesAfterFirst).toHaveLength(1)

      // Third poll — new change but within cooldown
      await advanceAndFlush(POLL_MS)

      const messagesAfterSecond = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(messagesAfterSecond).toHaveLength(1) // still 1, cooldown not expired

      // Advance past cooldown (180s total needed, already did 2*60=120, need 60 more + 1 poll)
      await advanceAndFlush(POLL_MS)
      await advanceAndFlush(POLL_MS)

      const messagesAfterCooldown = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(messagesAfterCooldown).toHaveLength(2) // fires again after cooldown
    })
  })

  // ---- Window-specific polling ----

  describe('window-specific polling', () => {
    it('uses captureWindow for rules targeting a specific app', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*', app: 'Chrome' } })],
      })

      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      expect(api.captureWindow).toHaveBeenCalledWith('Chrome')
    })

    it('uses captureScreenshot (fullscreen) when app is empty', async () => {
      const api = window.electronAPI!
      vi.mocked(api.captureScreenshot).mockClear()

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      expect(api.captureScreenshot).toHaveBeenCalled()
    })
  })
})
