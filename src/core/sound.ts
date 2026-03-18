import { useConfigStore } from '@/stores/configStore'

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

type SoundName = 'click' | 'reply' | 'complete' | 'alert'

const generators: Record<SoundName, (ac: AudioContext) => void> = {
  click(ac) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = 800
    gain.gain.setValueAtTime(0.15, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05)
    osc.connect(gain).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + 0.05)
  },
  reply(ac) {
    const t = ac.currentTime
    const notes = [523, 784]
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.12, t + i * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.1)
      osc.connect(gain).connect(ac.destination)
      osc.start(t + i * 0.1)
      osc.stop(t + i * 0.1 + 0.1)
    })
  },
  complete(ac) {
    const t = ac.currentTime
    const notes = [523, 659, 784]
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.12, t + i * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.08)
      osc.connect(gain).connect(ac.destination)
      osc.start(t + i * 0.08)
      osc.stop(t + i * 0.08 + 0.08)
    })
  },
  alert(ac) {
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.setValueAtTime(200, t + 0.05)
    osc.frequency.setValueAtTime(220, t + 0.1)
    osc.frequency.setValueAtTime(200, t + 0.15)
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  },
}

export function playSound(name: SoundName): void {
  if (!useConfigStore.getState().soundEnabled) return
  try {
    const ac = getCtx()
    if (ac.state === 'suspended') ac.resume()
    generators[name](ac)
  } catch { /* ignore audio errors */ }
}
