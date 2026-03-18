import { useConfigStore } from '@/stores/configStore'
import { messages } from './messages'

function resolveLanguage(lang: 'zh' | 'en' | 'auto'): 'zh' | 'en' {
  if (lang === 'auto') {
    return typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'zh'
  }
  return lang
}

export function useI18n() {
  const lang = useConfigStore((s) => s.language)
  const resolved = resolveLanguage(lang)

  return {
    t: (key: string) => messages[resolved]?.[key] ?? messages.zh[key] ?? key,
    lang: resolved,
  }
}

/** Non-hook version for use outside React components */
export function t(key: string, lang?: 'zh' | 'en' | 'auto'): string {
  const l = resolveLanguage(lang ?? 'auto')
  return messages[l]?.[key] ?? messages.zh[key] ?? key
}
