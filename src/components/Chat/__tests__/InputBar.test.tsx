import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InputBar from '../InputBar'

vi.mock('@/hooks/useAI', () => ({
  useAI: () => ({
    sendMessage: vi.fn(),
    abort: vi.fn(),
  }),
}))

const mockToggle = vi.fn()
const mockUseVoiceInput = vi.fn((_onResult?: (text: string) => void): {
  isListening: boolean
  isInitializing: boolean
  downloadProgress: { status: string; progress?: number } | null
  error: string | null
  toggle: () => void
} => ({
  isListening: false,
  isInitializing: false,
  downloadProgress: null,
  error: null,
  toggle: mockToggle,
}))

vi.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: (onResult: (text: string) => void) => mockUseVoiceInput(onResult),
}))

vi.mock('@/hooks/useMonitor', () => ({
  markUserActive: vi.fn(),
}))

vi.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    lang: 'zh',
  }),
}))

vi.mock('@/stores/chatStore', () => ({
  useChatStore: Object.assign(
    vi.fn((selector?: any) => {
      const state = { isStreaming: false, pendingPrompt: null }
      return selector ? selector(state) : state
    }),
    { getState: () => ({ setPendingPrompt: vi.fn() }) }
  ),
}))

vi.mock('../SlashMenu', () => ({
  default: () => <div data-testid="slash-menu">SlashMenu</div>,
}))

describe('InputBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseVoiceInput.mockReturnValue({
      isListening: false,
      isInitializing: false,
      downloadProgress: null,
      error: null,
      toggle: mockToggle,
    })
  })

  it('renders textarea and voice button', () => {
    render(<InputBar />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    // Voice button with microphone emoji
    expect(screen.getByTitle('chat.voiceInput')).toBeInTheDocument()
  })

  it('voice button shows microphone emoji when idle', () => {
    render(<InputBar />)
    const voiceBtn = screen.getByTitle('chat.voiceInput')
    expect(voiceBtn.textContent).toBe('\uD83C\uDFA4')
  })

  it('voice button has animate-pulse class when initializing', () => {
    mockUseVoiceInput.mockReturnValue({
      isListening: false,
      isInitializing: true,
      downloadProgress: null,
      error: null,
      toggle: mockToggle,
    })
    render(<InputBar />)
    const voiceBtn = screen.getByTitle('chat.sttLoading')
    expect(voiceBtn.className).toContain('animate-pulse')
  })

  it('voice button has animate-pulse-mic class when listening', () => {
    mockUseVoiceInput.mockReturnValue({
      isListening: true,
      isInitializing: false,
      downloadProgress: null,
      error: null,
      toggle: mockToggle,
    })
    render(<InputBar />)
    const voiceBtn = screen.getByTitle('chat.stopRecording')
    expect(voiceBtn.className).toContain('animate-pulse-mic')
  })

  it('shows voice error when error is set', () => {
    mockUseVoiceInput.mockReturnValue({
      isListening: false,
      isInitializing: false,
      downloadProgress: null,
      error: 'Microphone not found',
      toggle: mockToggle,
    })
    render(<InputBar />)
    expect(screen.getByText('Microphone not found')).toBeInTheDocument()
  })

  it('shows download progress when isInitializing and downloadProgress are set', () => {
    mockUseVoiceInput.mockReturnValue({
      isListening: false,
      isInitializing: true,
      downloadProgress: { progress: 42, status: 'downloading' },
      error: null,
      toggle: mockToggle,
    })
    render(<InputBar />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<InputBar />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('')
    // The send button (arrow up) should be disabled
    const sendBtn = screen.getByText('\u2191')
    expect(sendBtn).toBeDisabled()
  })

  it('stop button appears when streaming', async () => {
    const { useChatStore } = await import('@/stores/chatStore')
    ;(useChatStore as any).mockImplementation((selector?: any) => {
      const state = { isStreaming: true, pendingPrompt: null }
      return selector ? selector(state) : state
    })

    render(<InputBar />)
    // Stop button shows square character
    expect(screen.getByText('\u25A0')).toBeInTheDocument()
    expect(screen.getByTitle('chat.stop')).toBeInTheDocument()
  })
})
