import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPanel from '../SettingsPanel'
import { useConfigStore } from '@/stores/configStore'

vi.mock('@/core/ai/testConnection', () => ({
  testConnection: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/core/errors/humanize', () => ({
  humanizeError: vi.fn((err: any) => String(err)),
}))

vi.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    lang: 'zh',
  }),
}))

vi.mock('../MemoryViewer', () => ({
  default: () => <div data-testid="memory-viewer">MemoryViewer</div>,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('SettingsPanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useConfigStore.setState({
      provider: 'claude',
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-20250514',
      baseUrl: '',
      groupId: '',
      verbosity: 0.3,
      formality: 0.7,
      proactivity: 0.3,
      language: 'zh',
      soundEnabled: true,
      visionEnabled: false,
      ttsEnabled: false,
      isOnboarded: true,
      userName: 'Test',
      thirdPerson: false,
      screenTimeReminder: 0,
      tokenBudget: 'balanced',
      sttModel: 'Xenova/whisper-tiny',
      sttLanguage: 'auto',
    })
  })

  it('renders settings panel with tabs', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('settings.tab.ai')).toBeInTheDocument()
    expect(screen.getByText('settings.tab.personality')).toBeInTheDocument()
    expect(screen.getByText('settings.tab.memory')).toBeInTheDocument()
    expect(screen.getByText('settings.tab.general')).toBeInTheDocument()
  })

  it('shows AI tab by default', () => {
    render(<SettingsPanel onClose={onClose} />)
    // AI tab shows provider list and test button
    expect(screen.getByText('settings.ai.service')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('settings.ai.test')).toBeInTheDocument()
  })

  it('clicking general tab shows general settings', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('settings.tab.general'))
    expect(screen.getByText('settings.general.language')).toBeInTheDocument()
  })

  it('shows vision toggle in general tab', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('settings.tab.general'))
    // Vision section title contains '视觉分析' (full: '视觉分析 (YOLO + OCR)')
    expect(screen.getByText(/视觉分析/)).toBeInTheDocument()
  })

  it('vision status component renders', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('settings.tab.general'))
    // VisionSetup and STTSetup both initially show '检查中...' when lang is 'zh'
    // Use getAllByText since both components show this status text
    const checkingElements = screen.getAllByText('检查中...')
    expect(checkingElements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows STT model selector in general tab', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('settings.tab.general'))
    // STTSetup renders inline label '模型' (zh) and a select with 'Tiny' option
    expect(screen.getByText('模型')).toBeInTheDocument()
  })

  it('shows STT language selector in general tab', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('settings.tab.general'))
    // STTSetup renders inline label '识别语言' (zh)
    expect(screen.getByText('识别语言')).toBeInTheDocument()
  })

  it('shows TTS toggle in general tab', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('settings.tab.general'))
    expect(screen.getByText('settings.general.tts')).toBeInTheDocument()
  })

  it('close button calls onClose', () => {
    render(<SettingsPanel onClose={onClose} />)
    // Close button is the '×' character
    fireEvent.click(screen.getByText('\u00D7'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
