import { useConfigStore } from '@/stores/configStore'

const TTS_RATE = 1.1
const TTS_PITCH = 1.2

export function speakText(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()

  // Clean markdown formatting
  const clean = text
    .replace(/[*_~`#]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, '. ')

  const utterance = new SpeechSynthesisUtterance(clean)

  // Language-aware voice selection
  const lang = useConfigStore.getState().language
  const voices = window.speechSynthesis.getVoices()

  let preferredVoice: SpeechSynthesisVoice | undefined
  if (lang === 'en') {
    preferredVoice = voices.find((v) => v.lang.startsWith('en'))
  } else {
    // Default to Chinese (zh or auto)
    preferredVoice = voices.find((v) => v.lang.startsWith('zh'))
  }

  // Fallback: use any available voice if preferred not found
  if (!preferredVoice && voices.length > 0) {
    preferredVoice = voices.find((v) => v.default) || voices[0]
  }

  if (preferredVoice) utterance.voice = preferredVoice

  utterance.rate = TTS_RATE
  utterance.pitch = TTS_PITCH

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}
