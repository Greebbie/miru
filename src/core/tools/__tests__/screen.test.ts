import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockElectronAPI } from '@/test/helpers'

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
      // The lines portion is sliced to 200 chars, but "50 apps: " prefix is added
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

  // ─── analyze_screen ─────────────────────────────────────────────────

  describe('analyze_screen', () => {
    it('auto-initializes vision when not initialized', async () => {
      mockAPI.visionStatus.mockResolvedValue({ initialized: false })
      mockAPI.visionAnalyze.mockResolvedValue({
        detections: [],
        ocrText: 'Hello',
        summary: 'OCR: Hello',
      })

      const result = await toolRegistry.get('analyze_screen')!.execute({})

      expect(mockAPI.visionInit).toHaveBeenCalledTimes(1)
      expect(mockAPI.visionAnalyze).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.summary).toBe('OCR: Hello')
    })

    it('skips init when already initialized', async () => {
      mockAPI.visionStatus.mockResolvedValue({ initialized: true })
      mockAPI.visionAnalyze.mockResolvedValue({
        detections: [],
        ocrText: 'Test',
        summary: 'OCR: Test',
      })

      await toolRegistry.get('analyze_screen')!.execute({})

      expect(mockAPI.visionInit).not.toHaveBeenCalled()
      expect(mockAPI.visionAnalyze).toHaveBeenCalledTimes(1)
    })

    it('returns error on IPC failure', async () => {
      mockAPI.visionStatus.mockRejectedValue(new Error('service unavailable'))
      const result = await toolRegistry.get('analyze_screen')!.execute({})
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
      expect(result.summary).toBe('[截图已捕获]')
      expect(mockAPI.visionAnalyze).not.toHaveBeenCalled()
    })

    it('falls back to YOLO+OCR when provider is not vision-capable', async () => {
      mockedIsVisionCapable.mockReturnValue(false)
      mockAPI.visionStatus.mockResolvedValue({ initialized: false })
      mockAPI.visionAnalyze.mockResolvedValue({
        detections: [{ label: 'button', confidence: 0.95, bbox: [0, 0, 50, 50] }],
        ocrText: 'Click me',
        summary: '1 object, OCR: Click me',
      })

      const result = await toolRegistry.get('describe_screen')!.execute({})

      expect(mockAPI.visionInit).toHaveBeenCalledTimes(1)
      expect(mockAPI.visionAnalyze).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.summary).toBe('1 object, OCR: Click me')
      expect(mockAPI.captureScreenshot).not.toHaveBeenCalled()
    })

    it('skips vision init in fallback path when already initialized', async () => {
      mockedIsVisionCapable.mockReturnValue(false)
      mockAPI.visionStatus.mockResolvedValue({ initialized: true })
      mockAPI.visionAnalyze.mockResolvedValue({
        detections: [],
        ocrText: '',
        summary: 'nothing detected',
      })

      await toolRegistry.get('describe_screen')!.execute({})

      expect(mockAPI.visionInit).not.toHaveBeenCalled()
    })

    it('returns error on IPC failure', async () => {
      mockedIsVisionCapable.mockReturnValue(true)
      mockAPI.captureScreenshot.mockRejectedValue(new Error('EACCES permission denied'))
      const result = await toolRegistry.get('describe_screen')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).toContain('permission')
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

  // ─── analyze_active_window ──────────────────────────────────────────

  describe('analyze_active_window', () => {
    it('gets active window then analyzes it', async () => {
      mockAPI.getActiveWindow.mockResolvedValue({ app: 'Notepad', title: 'readme.txt' })
      mockAPI.visionStatus.mockResolvedValue({ initialized: true })
      mockAPI.visionAnalyzeWindow.mockResolvedValue({
        detections: [],
        ocrText: 'file content',
        summary: 'OCR: file content',
      })

      const result = await toolRegistry.get('analyze_active_window')!.execute({})

      expect(mockAPI.getActiveWindow).toHaveBeenCalledTimes(1)
      expect(mockAPI.visionAnalyzeWindow).toHaveBeenCalledWith('Notepad')
      expect(result.success).toBe(true)
      expect(result.summary).toBe('Notepad: OCR: file content')
    })

    it('auto-initializes vision when not initialized', async () => {
      mockAPI.getActiveWindow.mockResolvedValue({ app: 'Code', title: 'test.ts' })
      mockAPI.visionStatus.mockResolvedValue({ initialized: false })
      mockAPI.visionAnalyzeWindow.mockResolvedValue({
        detections: [],
        ocrText: 'code',
        summary: 'OCR: code',
      })

      await toolRegistry.get('analyze_active_window')!.execute({})

      expect(mockAPI.visionInit).toHaveBeenCalledTimes(1)
      expect(mockAPI.visionAnalyzeWindow).toHaveBeenCalledWith('Code')
    })

    it('returns error on IPC failure', async () => {
      mockAPI.getActiveWindow.mockRejectedValue(new Error('not found'))
      const result = await toolRegistry.get('analyze_active_window')!.execute({})
      expect(result.success).toBe(false)
    })
  })

  // ─── electronAPI null guard ─────────────────────────────────────────

  describe('electronAPI null guard', () => {
    const toolNames = [
      'get_active_window',
      'list_processes',
      'analyze_screen',
      'describe_screen',
      'capture_screenshot',
      'analyze_active_window',
    ] as const

    it.each(toolNames)('%s returns error when electronAPI is undefined', async (toolName) => {
      const savedAPI = (window as any).electronAPI
      ;(window as any).electronAPI = undefined

      try {
        const result = await toolRegistry.get(toolName)!.execute({})
        expect(result.success).toBe(false)
        expect(result.data).toBeNull()
        expect(result.summary).toContain('Miru')
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

    it('provides fallback for unknown errors', async () => {
      mockAPI.visionStatus.mockRejectedValue(new Error('bizarre_error'))
      const result = await toolRegistry.get('analyze_screen')!.execute({})
      expect(result.success).toBe(false)
      expect(result.summary).toContain('Miru')
    })
  })
})
