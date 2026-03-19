import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockElectronAPI } from '@/test/helpers'
import { useConfigStore } from '@/stores/configStore'

// Mock isVisionCapable before importing screen tools
vi.mock('@/core/ai/createProvider', () => ({
  isVisionCapable: vi.fn(() => true),
  createProvider: vi.fn(),
}))

// Import after mocks are set up
import { toolRegistry } from '../registry'
import { isVisionCapable } from '@/core/ai/createProvider'

// Register screen tools (side-effect import)
import '../screen'

const mockedIsVisionCapable = isVisionCapable as ReturnType<typeof vi.fn>

describe('screen tools', () => {
  let mockAPI: ReturnType<typeof createMockElectronAPI>

  beforeEach(() => {
    vi.clearAllMocks()
    mockAPI = createMockElectronAPI()
    ;(window as any).electronAPI = mockAPI
    mockedIsVisionCapable.mockReturnValue(true)
    // Set visionTarget to fullscreen by default so describe_screen works
    useConfigStore.setState({ visionTarget: 'fullscreen' })
  })

  // ─── get_active_window ──────────────────────────────────────────────

  describe('get_active_window', () => {
    it('returns app and title in summary', async () => {
      mockAPI.getActiveWindow.mockResolvedValue({ app: 'Chrome', title: 'GitHub' })
      const result = await toolRegistry.get('get_active_window')!.execute({})
      expect(result.success).toBe(true)
      expect(result.summary).toBe('Chrome - GitHub')
      expect(result.data).toEqual({ app: 'Chrome', title: 'GitHub' })
    })

    it('shows (no title) when title is empty', async () => {
      mockAPI.getActiveWindow.mockResolvedValue({ app: 'Finder', title: '' })
      const result = await toolRegistry.get('get_active_window')!.execute({})
      expect(result.summary).toBe('Finder - (no title)')
    })

    it('returns error on IPC failure', async () => {
      mockAPI.getActiveWindow.mockRejectedValue(new Error('timeout'))
      const result = await toolRegistry.get('get_active_window')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).not.toContain('timeout')
    })
  })

  // ─── list_processes ─────────────────────────────────────────────────

  describe('list_processes', () => {
    it('returns process count and names', async () => {
      mockAPI.getProcessList.mockResolvedValue([
        { name: 'Code', title: 'main.ts', pid: 1 },
        { name: 'Chrome', title: '', pid: 2 },
      ])
      const result = await toolRegistry.get('list_processes')!.execute({})
      expect(result.success).toBe(true)
      expect(result.summary).toContain('2 apps')
      expect(result.summary).toContain('Code - main.ts')
      expect(result.summary).toContain('Chrome')
    })

    it('truncates summary at 200 chars', async () => {
      const longList = Array.from({ length: 50 }, (_, i) => ({
        name: `Application_With_Very_Long_Name_${i}`,
        title: `Window Title Number ${i}`,
        pid: i,
      }))
      mockAPI.getProcessList.mockResolvedValue(longList)
      const result = await toolRegistry.get('list_processes')!.execute({})
      const linesStart = result.summary.indexOf(': ') + 2
      const linesPart = result.summary.slice(linesStart)
      expect(linesPart.length).toBeLessThanOrEqual(200)
    })

    it('returns error on IPC failure', async () => {
      mockAPI.getProcessList.mockRejectedValue(new Error('ECONNREFUSED'))
      const result = await toolRegistry.get('list_processes')!.execute({})
      expect(result.success).toBe(false)
    })
  })

  // ─── describe_screen ────────────────────────────────────────────────

  describe('describe_screen', () => {
    it('returns _image data when provider is vision-capable', async () => {
      mockedIsVisionCapable.mockReturnValue(true)
      mockAPI.captureScreenshot.mockResolvedValue('data:image/jpeg;base64,abc123')

      const result = await toolRegistry.get('describe_screen')!.execute({})

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ _image: 'data:image/jpeg;base64,abc123' })
      expect(result.summary).toBe('[截图已捕获，等待 AI 分析]')
    })

    it('returns error when vision is off', async () => {
      useConfigStore.setState({ visionTarget: 'off' })

      const result = await toolRegistry.get('describe_screen')!.execute({})

      expect(result.success).toBe(false)
      expect(result.summary).toContain('视觉功能已关闭')
    })

    it('captures specific window when visionTarget is a window name', async () => {
      useConfigStore.setState({ visionTarget: 'Chrome' })
      mockAPI.captureWindow.mockResolvedValue('data:image/jpeg;base64,chrome123')

      const result = await toolRegistry.get('describe_screen')!.execute({})

      expect(result.success).toBe(true)
      expect(mockAPI.captureWindow).toHaveBeenCalledWith('Chrome')
    })

    it('returns error when provider is not vision-capable', async () => {
      mockedIsVisionCapable.mockReturnValue(false)

      const result = await toolRegistry.get('describe_screen')!.execute({})

      expect(result.success).toBe(false)
      expect(result.summary).toContain('不支持视觉')
    })

    it('returns error on IPC failure', async () => {
      mockedIsVisionCapable.mockReturnValue(true)
      mockAPI.captureScreenshot.mockRejectedValue(new Error('EACCES permission denied'))
      const result = await toolRegistry.get('describe_screen')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).toContain('permission')
    })
  })

  // ─── describe_window ────────────────────────────────────────────────

  describe('describe_window', () => {
    it('returns _image data for specified window', async () => {
      mockedIsVisionCapable.mockReturnValue(true)
      mockAPI.captureWindow.mockResolvedValue('data:image/jpeg;base64,window123')

      const result = await toolRegistry.get('describe_window')!.execute({ window_name: 'Chrome' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ _image: 'data:image/jpeg;base64,window123' })
      expect(mockAPI.captureWindow).toHaveBeenCalledWith('Chrome')
    })

    it('returns error when provider is not vision-capable', async () => {
      mockedIsVisionCapable.mockReturnValue(false)

      const result = await toolRegistry.get('describe_window')!.execute({ window_name: 'Chrome' })

      expect(result.success).toBe(false)
      expect(result.summary).toContain('不支持视觉')
    })

    it('returns error when window not found', async () => {
      mockedIsVisionCapable.mockReturnValue(true)
      mockAPI.captureWindow.mockRejectedValue(new Error('Window "FakeApp" not found'))

      const result = await toolRegistry.get('describe_window')!.execute({ window_name: 'FakeApp' })

      expect(result.success).toBe(false)
    })
  })

  // ─── capture_screenshot ─────────────────────────────────────────────

  describe('capture_screenshot', () => {
    it('returns data URL', async () => {
      mockAPI.captureScreenshot.mockResolvedValue('data:image/jpeg;base64,/9j/mock')

      const result = await toolRegistry.get('capture_screenshot')!.execute({})

      expect(result.success).toBe(true)
      expect(result.data).toBe('data:image/jpeg;base64,/9j/mock')
      expect(result.summary).toBe('Screenshot captured (640x360 JPEG)')
    })

    it('returns error on IPC failure', async () => {
      mockAPI.captureScreenshot.mockRejectedValue(new Error('500 internal server error'))
      const result = await toolRegistry.get('capture_screenshot')!.execute({})
      expect(result.success).toBe(false)
    })
  })

  // ─── capture_window ─────────────────────────────────────────────────

  describe('capture_window', () => {
    it('returns data URL for specified window', async () => {
      mockAPI.captureWindow.mockResolvedValue('data:image/jpeg;base64,/9j/window')

      const result = await toolRegistry.get('capture_window')!.execute({ window_name: 'Notepad' })

      expect(result.success).toBe(true)
      expect(result.data).toBe('data:image/jpeg;base64,/9j/window')
      expect(result.summary).toBe('窗口 "Notepad" 截图完成')
      expect(mockAPI.captureWindow).toHaveBeenCalledWith('Notepad')
    })

    it('returns error when window not found', async () => {
      mockAPI.captureWindow.mockRejectedValue(new Error('Window "FakeApp" not found'))

      const result = await toolRegistry.get('capture_window')!.execute({ window_name: 'FakeApp' })

      expect(result.success).toBe(false)
    })
  })

  // ─── electronAPI null guard ─────────────────────────────────────────

  describe('electronAPI null guard', () => {
    const toolNames = [
      'get_active_window',
      'list_processes',
      'describe_screen',
      'capture_screenshot',
      'describe_window',
      'capture_window',
    ] as const

    it.each(toolNames)('%s returns error when electronAPI is undefined', async (toolName) => {
      const savedAPI = (window as any).electronAPI
      ;(window as any).electronAPI = undefined

      try {
        const params = toolName === 'describe_window' || toolName === 'capture_window'
          ? { window_name: 'test' }
          : {}
        const result = await toolRegistry.get(toolName)!.execute(params)
        expect(result.success).toBe(false)
        expect(result.data).toBeNull()
        expect(result.summary).toContain('Niromi')
      } finally {
        ;(window as any).electronAPI = savedAPI
      }
    })
  })

  // ─── error humanization ─────────────────────────────────────────────

  describe('error humanization', () => {
    it('translates network error', async () => {
      mockAPI.getActiveWindow.mockRejectedValue(new Error('fetch failed'))
      const result = await toolRegistry.get('get_active_window')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).not.toContain('fetch failed')
    })

    it('translates permission error', async () => {
      mockAPI.captureScreenshot.mockRejectedValue(new Error('EACCES permission denied'))
      const result = await toolRegistry.get('capture_screenshot')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).toContain('permission')
    })

    it('translates timeout error', async () => {
      mockAPI.getProcessList.mockRejectedValue(new Error('Request timed out'))
      const result = await toolRegistry.get('list_processes')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).toContain('No response after a long wait')
    })
  })
})
