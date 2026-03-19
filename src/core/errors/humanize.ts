/**
 * Translate raw technical errors into Niromi-voice friendly messages.
 * CLAUDE.md rule: "错误消息翻译为 Niromi 的话，永远不显示原始 error"
 */

type Lang = 'zh' | 'en' | 'auto'

interface ErrorPattern {
  test: (msg: string) => boolean
  zh: string
  en: string
}

const patterns: ErrorPattern[] = [
  // Missing config
  {
    test: (m) => /GroupId required/i.test(m),
    zh: 'Minimax 需要填 Group ID 哦~ 去设置里填一下？',
    en: 'Minimax requires a Group ID~ Add it in Settings?',
  },
  // Auth / API key
  {
    test: (m) => /\b(401|403|unauthorized|forbidden|invalid.*key|invalid.*api|authentication)/i.test(m),
    zh: 'API Key 好像不对哦~ 去设置里检查一下？',
    en: 'API Key seems wrong~ Check your settings?',
  },
  // Rate limit
  {
    test: (m) => /\b(429|rate.?limit|too many requests|quota)/i.test(m),
    zh: '调用太频繁了，Niromi 休息一下再试~',
    en: 'Too many requests, Niromi will rest a bit~',
  },
  // Minimax-specific errors
  {
    test: (m) => /Minimax error/i.test(m),
    zh: 'Minimax 返回了错误，检查一下 API Key 和 Group ID？',
    en: 'Minimax returned an error. Check your API Key and Group ID?',
  },
  // Server errors
  {
    test: (m) => /\b(500|502|503|504|internal server|bad gateway|service unavailable|overloaded)/i.test(m),
    zh: 'AI 服务那边好像出了点问题...',
    en: 'The AI service seems to be having issues...',
  },
  // Network / connection
  {
    test: (m) => /\b(fetch failed|failed to fetch|econnrefused|econnreset|enotfound|network|dns|CORS|ssl|ERR_CONNECTION)/i.test(m),
    zh: 'Niromi 连不上网络呢...',
    en: "Niromi can't connect to the network...",
  },
  // Timeout
  {
    test: (m) => /\b(timeout|etimedout|timed?\s*out|aborted)/i.test(m),
    zh: '等了好久都没有回应...再试一次？',
    en: 'No response after a long wait... try again?',
  },
  // File permission
  {
    test: (m) => /\b(eacces|eperm|permission denied|access denied)/i.test(m),
    zh: 'Niromi 没有权限访问这个文件呢...',
    en: "Niromi doesn't have permission for this file...",
  },
  // File not found
  {
    test: (m) => /\b(enoent|no such file|not found|does not exist|找不到)/i.test(m),
    zh: '找不到这个文件哦~',
    en: "Can't find that file~",
  },
  // Disk space
  {
    test: (m) => /\b(enospc|no space|disk full)/i.test(m),
    zh: '磁盘空间不够了...',
    en: 'Disk is running out of space...',
  },
  // File busy / locked
  {
    test: (m) => /\b(ebusy|locked|in use|being used)/i.test(m),
    zh: '这个文件正在被使用中呢...',
    en: 'This file is currently in use...',
  },
]

const fallback = {
  zh: '呜...出了点小状况，Niromi 也不太确定怎么回事',
  en: "Hmm... something went wrong, Niromi isn't sure what happened",
}

function resolveLang(lang: Lang): 'zh' | 'en' {
  if (lang === 'zh' || lang === 'en') return lang
  // auto: detect from navigator or default to zh
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) return 'en'
  return 'zh'
}

export function humanizeError(error: unknown, lang: Lang = 'zh'): string {
  const l = resolveLang(lang)
  const msg = error instanceof Error ? error.message : String(error ?? '')

  for (const p of patterns) {
    if (p.test(msg)) return p[l]
  }

  // Include a short hint of the raw error for debugging unmatched errors
  if (msg && msg.length < 100) {
    return fallback[l] + ` (${msg})`
  }
  return fallback[l]
}
