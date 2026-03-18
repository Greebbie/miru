import { useEffect, useRef } from 'react'
import { useConfigStore } from '@/stores/configStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useChatStore } from '@/stores/chatStore'
import { playSound } from '@/core/sound'
import { useI18n } from '@/i18n/useI18n'

export function useScreenTime(): void {
  const screenTimeReminder = useConfigStore((s) => s.screenTimeReminder)
  const lastInteraction = useCharacterStore((s) => s.lastInteraction)
  const startRef = useRef(Date.now())
  const { t } = useI18n()

  // Reset timer on interaction
  useEffect(() => {
    startRef.current = Date.now()
  }, [lastInteraction])

  useEffect(() => {
    if (!screenTimeReminder) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 60000)
      if (elapsed >= screenTimeReminder) {
        const msg = t('screenTime.reminder').replace('{minutes}', String(elapsed))
        useChatStore.getState().addMessage({ role: 'assistant', content: msg })
        useCharacterStore.getState().setEmotions({ concern: 0.4 })
        playSound('alert')
        startRef.current = Date.now()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [screenTimeReminder, t])
}
