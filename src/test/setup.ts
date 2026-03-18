import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { createMockElectronAPI } from './helpers'

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: createMockElectronAPI(),
  writable: true,
  configurable: true,
})

// Mock speechSynthesis
const mockUtterance = vi.fn()
Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: vi.fn().mockImplementation((text: string) => ({
    text,
    voice: null,
    rate: 1,
    pitch: 1,
    lang: '',
  })),
  writable: true,
})

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: vi.fn(() => [
      { lang: 'zh-CN', name: 'Chinese Voice', default: false, localService: true, voiceURI: 'zh' },
      { lang: 'en-US', name: 'English Voice', default: true, localService: true, voiceURI: 'en' },
    ]),
    speak: vi.fn(),
    cancel: vi.fn(),
    speaking: false,
    paused: false,
    pending: false,
    onvoiceschanged: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  },
  writable: true,
  configurable: true,
})

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn(), kind: 'audio' }],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
  writable: true,
  configurable: true,
})

// Mock AudioContext
const mockAudioContext = {
  sampleRate: 16000,
  currentTime: 0,
  state: 'running' as AudioContextState,
  destination: {} as AudioDestinationNode,
  decodeAudioData: vi.fn().mockResolvedValue({
    getChannelData: vi.fn(() => new Float32Array(16000)),
    numberOfChannels: 1,
    sampleRate: 16000,
    length: 16000,
    duration: 1,
  }),
  close: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  })),
}

;(globalThis as any).AudioContext = vi.fn(() => ({ ...mockAudioContext }))

// Mock MediaRecorder
class MockMediaRecorder {
  state = 'inactive' as RecordingState
  ondataavailable: ((e: any) => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((e: any) => void) | null = null

  constructor(public stream: any, public options?: any) {}

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    // Simulate data available
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test audio data'], { type: 'audio/webm' }) })
    }
    if (this.onstop) {
      this.onstop()
    }
  }

  static isTypeSupported(type: string) {
    return type === 'audio/webm;codecs=opus' || type === 'audio/webm'
  }
}

;(globalThis as any).MediaRecorder = MockMediaRecorder
