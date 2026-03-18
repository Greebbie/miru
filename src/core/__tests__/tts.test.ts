import { describe, it, expect, vi, beforeEach } from 'vitest'
import { speakText, stopSpeaking } from '../tts'
import { useConfigStore } from '@/stores/configStore'

describe('tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConfigStore.setState({ language: 'zh' })
  })

  describe('speakText', () => {
    it('cleans markdown formatting from text', () => {
      speakText('**bold** _italic_ ~strike~ `code` # heading')

      expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith(
        'bold italic strike code  heading'
      )
      expect(window.speechSynthesis.speak).toHaveBeenCalled()
    })

    it('removes link syntax and keeps link text', () => {
      speakText('[click here](https://example.com)')

      expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('click here')
    })

    it('replaces newlines with period-space', () => {
      speakText('line one\nline two\n\nline three')

      expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('line one. line two. line three')
    })

    it('selects Chinese voice when language is zh', () => {
      useConfigStore.setState({ language: 'zh' })

      speakText('你好')

      const utterance = (window.SpeechSynthesisUtterance as ReturnType<typeof vi.fn>).mock.results[0].value
      expect(utterance.voice.lang).toBe('zh-CN')
    })

    it('selects English voice when language is en', () => {
      useConfigStore.setState({ language: 'en' })

      speakText('hello')

      const utterance = (window.SpeechSynthesisUtterance as ReturnType<typeof vi.fn>).mock.results[0].value
      expect(utterance.voice.lang).toBe('en-US')
    })

    it('falls back to default voice when preferred not found', () => {
      ;(window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
        { lang: 'ja-JP', name: 'Japanese Voice', default: true, localService: true, voiceURI: 'ja' },
      ])
      useConfigStore.setState({ language: 'zh' })

      speakText('test')

      // Should fall back to default voice (ja-JP in this case)
      const utterance = (window.SpeechSynthesisUtterance as ReturnType<typeof vi.fn>).mock.results[0].value
      expect(utterance.voice.lang).toBe('ja-JP')
    })

    it('cancels previous speech before starting new', () => {
      speakText('first')
      speakText('second')

      expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2)
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2)
    })

    it('does nothing if speechSynthesis not available', () => {
      const original = window.speechSynthesis
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      // Should not throw
      expect(() => speakText('test')).not.toThrow()

      // Restore
      Object.defineProperty(window, 'speechSynthesis', {
        value: original,
        writable: true,
        configurable: true,
      })
    })
  })

  describe('stopSpeaking', () => {
    it('calls cancel on speechSynthesis', () => {
      stopSpeaking()

      expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    })
  })
})
