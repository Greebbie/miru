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
}))

vi.mock('@/i18n/useI18n', () => ({
  t: (key: string) => key,
}))

/** Polling interval used by all test rules (must be >= 5000, the module floor) */
const POLL_MS = 10_000

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

function makeAutoReplyRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ar-1',
    name: 'Auto Reply Test',
    enabled: true,
    app: 'wechat' as const,
    triggerKeywords: ['hello', 'help'],
    replyTemplate: 'I am busy',
    useAI: false,
    requireConfirm: false,
    ...overrides,
  }
}

/** Advance fake timers and flush all pending microtasks (promises) */
async function advanceAndFlush(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('useVisionMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Reset stores to clean state
    useChatStore.setState({ messages: [] })
    useAdminStore.setState({
      monitorRules: [],
      autoReplyRules: [],
    })

    // Reset electronAPI mocks
    const api = window.electronAPI!
    vi.mocked(api.visionStatus).mockResolvedValue({ initialized: true })
    vi.mocked(api.visionAnalyze).mockResolvedValue({
      detections: [],
      ocrText: '',
      summary: '',
    })
    vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
      detections: [],
      ocrText: '',
      summary: '',
    })
    vi.mocked(api.visionInit).mockResolvedValue({ success: true })
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

  // ---- Vision init ----

  describe('auto-init on monitor start', () => {
    it('calls visionInit() if not initialized', async () => {
      const api = window.electronAPI!
      vi.mocked(api.visionStatus).mockResolvedValue({ initialized: false })

      useAdminStore.setState({
        monitorRules: [makeMonitorRule()],
      })

      startVisionMonitor()

      // Let the async initVisionIfNeeded resolve
      await advanceAndFlush(0)

      expect(api.visionInit).toHaveBeenCalled()
    })

    it('does not call visionInit() if already initialized', async () => {
      const api = window.electronAPI!
      vi.mocked(api.visionStatus).mockResolvedValue({ initialized: true })
      vi.mocked(api.visionInit).mockClear()

      useAdminStore.setState({
        monitorRules: [makeMonitorRule()],
      })

      startVisionMonitor()
      await advanceAndFlush(0)

      expect(api.visionInit).not.toHaveBeenCalled()
    })
  })

  // ---- computeNewContent behavior (tested via poll cycle) ----

  describe('computeNewContent behavior via poll cycle', () => {
    it('when old and new text are the same, no action is triggered', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'line one\nline two',
        summary: '',
      })

      startVisionMonitor()

      // First poll — sets initial snapshot, no trigger (prevText empty)
      await advanceAndFlush(POLL_MS)

      // Second poll — same text, no new content
      await advanceAndFlush(POLL_MS)

      // Verify no notify message was added (beyond the initial start message)
      const messages = useChatStore.getState().messages
      const notifyMessages = messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages).toHaveLength(0)
    })

    it('when new text has additional lines, those new lines trigger rules', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      // First poll — initial snapshot
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'line one',
        summary: '',
      })

      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // Second poll — new line added
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'line one\nline two added',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      // The rule action is 'notify', so it adds a chat message
      const messages = useChatStore.getState().messages
      const notifyMessages = messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })
  })

  // ---- Cooldown behavior ----

  describe('checkCooldown behavior', () => {
    it('a rule that just fired should not fire again within cooldown', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({
          cooldownMs: 60000,
          trigger: { pattern: '.*' },
        })],
      })

      // First poll — initial snapshot
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'initial',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // Second poll — triggers rule (first real content change)
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'initial\nnew content A',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const messagesAfterFirst = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(messagesAfterFirst).toHaveLength(1)

      // Third poll — new content again but within cooldown (10s since trigger, cooldown is 60s)
      // Return same text to consume the new snapshot without triggering
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'initial\nnew content A',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const messagesAfterSecond = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(messagesAfterSecond).toHaveLength(1) // still 1, cooldown not expired

      // Advance past the cooldown (60s from trigger at ~20s, so we need to reach ~80s)
      // We are currently at ~30s. Advance 50s to reach ~80s. Keep returning same text.
      await advanceAndFlush(50000)

      // Now we're past cooldown. Introduce new content on the next poll.
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'initial\nnew content A\nnew content C',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const messagesAfterCooldown = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(messagesAfterCooldown).toHaveLength(2) // fires again
    })
  })

  // ---- Rule pattern matching ----

  describe('rule pattern matching', () => {
    it('regex pattern matching triggers action', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: 'error|fail' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'all good',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // New content with "error" in it
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'all good\nSome error occurred',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const notifyMessages = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })

    it('wildcard pattern .* matches everything', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'first',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'first\nanything here',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const notifyMessages = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })

    it('case-insensitive matching works', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: 'ERROR' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'start',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // lowercase "error" should match pattern "ERROR" (regex 'i' flag)
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'start\nsome error here',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const notifyMessages = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })

    it('invalid regex falls back to string includes', async () => {
      const api = window.electronAPI!

      // "[invalid" is an invalid regex
      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '[invalid' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'first',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // The string "[invalid" should be matched via includes (case-insensitive)
      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'first\ncontains [invalid here',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const notifyMessages = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })

    it('no match when pattern does not appear in new content', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: 'CRITICAL_FAILURE' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'line1',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'line1\nsome normal text',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      const notifyMessages = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages).toHaveLength(0)
    })
  })

  // ---- Auto-reply keyword detection ----

  describe('auto-reply keyword detection', () => {
    it('keywords in new OCR text trigger auto-reply', async () => {
      const api = window.electronAPI!

      const arRule = makeAutoReplyRule({
        app: 'wechat',
        triggerKeywords: ['hello'],
        replyTemplate: 'I am busy',
      })
      useAdminStore.setState({
        monitorRules: [],
        autoReplyRules: [arRule],
      })

      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'initial chat',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // New content includes keyword "hello"
      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'initial chat\nhello there',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      expect(api.clipboardWrite).toHaveBeenCalledWith('I am busy')
    })

    it('keywords are case-insensitive', async () => {
      const api = window.electronAPI!

      const arRule = makeAutoReplyRule({
        app: 'wechat',
        triggerKeywords: ['HELP'],
        replyTemplate: 'Wait a moment',
      })
      useAdminStore.setState({
        monitorRules: [],
        autoReplyRules: [arRule],
      })

      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'old text',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      // lowercase "help" should match keyword "HELP"
      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'old text\ncan you help me?',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      expect(api.clipboardWrite).toHaveBeenCalledWith('Wait a moment')
    })

    it('no match when keywords do not appear in new content', async () => {
      const api = window.electronAPI!
      vi.mocked(api.clipboardWrite).mockClear()

      const arRule = makeAutoReplyRule({
        app: 'wechat',
        triggerKeywords: ['urgent'],
        replyTemplate: 'On it',
      })
      useAdminStore.setState({
        monitorRules: [],
        autoReplyRules: [arRule],
      })

      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'old text',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'old text\njust a normal message',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      expect(api.clipboardWrite).not.toHaveBeenCalled()
    })
  })

  // ---- Window-specific polling ----

  describe('window-specific polling', () => {
    it('uses visionAnalyzeWindow for rules targeting a specific app', async () => {
      const api = window.electronAPI!

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*', app: 'Chrome' } })],
      })

      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'page one',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      vi.mocked(api.visionAnalyzeWindow).mockResolvedValue({
        detections: [],
        ocrText: 'page one\nnew stuff',
        summary: '',
      })
      await advanceAndFlush(POLL_MS)

      expect(api.visionAnalyzeWindow).toHaveBeenCalledWith('Chrome')
      const notifyMessages = useChatStore.getState().messages.filter(m => m.content.includes('Detected:'))
      expect(notifyMessages.length).toBeGreaterThan(0)
    })

    it('uses visionAnalyze (fullscreen) when app is empty', async () => {
      const api = window.electronAPI!
      vi.mocked(api.visionAnalyze).mockClear()

      useAdminStore.setState({
        monitorRules: [makeMonitorRule({ trigger: { pattern: '.*' } })],
      })

      vi.mocked(api.visionAnalyze).mockResolvedValue({
        detections: [],
        ocrText: 'screen',
        summary: '',
      })
      startVisionMonitor()
      await advanceAndFlush(POLL_MS)

      expect(api.visionAnalyze).toHaveBeenCalled()
    })
  })
})
