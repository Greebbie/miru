export function speakText(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()

  // Clean markdown formatting
  const clean = text
    .replace(/[*_~`#]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, '. ')

  const utterance = new SpeechSynthesisUtterance(clean)

  // Prefer Chinese voice
  const voices = window.speechSynthesis.getVoices()
  const zhVoice = voices.find((v) => v.lang.startsWith('zh'))
  if (zhVoice) utterance.voice = zhVoice

  utterance.rate = 1.1
  utterance.pitch = 1.2

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}
