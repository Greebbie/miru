import { memoryStore } from './store'

/**
 * Compress memory into a minimal string for system prompt injection.
 * Target: ~50-150 tokens total.
 *
 * Format:
 * [User] name:绿酱 | lang:zh | editor:Cursor
 * [Prefs] theme:dark | freq-tools:list_files,open_app
 * [Facts] 用户在做React项目 | 喜欢用Tailwind | 上周整理了文件结构
 * [Recent] 帮用户调试了vite配置(success) | 搜索了天气API(success)
 * [Screen] VS Code - main.ts
 */
export async function injectMemory(screenContext?: string, userMessage?: string, maxEpisodes?: number): Promise<string> {
  const parts: string[] = []

  // Identity line
  const identity = memoryStore.getIdentity()
  const idParts = Object.entries(identity)
    .filter(([, v]) => v)
    .map(([k, v]) => (k === 'name' ? v : `${k}:${v}`))
  if (idParts.length > 0) {
    parts.push(`[User] ${idParts.join(' | ')}`)
  }

  // Preferences line
  const prefs = memoryStore.getPreferences()
  const prefParts = Object.entries(prefs)
    .filter(([, v]) => v)
    .map(([k, v]) => (Array.isArray(v) ? `${k}:${v.join(',')}` : `${k}:${v}`))
  if (prefParts.length > 0) {
    parts.push(`[Prefs] ${prefParts.join(' | ')}`)
  }

  // Facts line — search by user message keywords via FTS5
  if (userMessage) {
    try {
      const keywords = extractKeywords(userMessage)
      if (keywords.length > 0) {
        const facts = await memoryStore.searchFacts(keywords.join(' OR '), 5)
        if (facts.length > 0) {
          const factParts = facts.map((f) => f.content.slice(0, 60))
          parts.push(`[Facts] ${factParts.join(' | ')}`)
        }
      }
    } catch { /* ignore search errors */ }
  }

  // If no keyword search, show recent facts
  if (!parts.some((p) => p.startsWith('[Facts]'))) {
    const recentFacts = memoryStore.getFacts().slice(-3)
    if (recentFacts.length > 0) {
      const factParts = recentFacts.map((f) => f.content.slice(0, 60))
      parts.push(`[Facts] ${factParts.join(' | ')}`)
    }
  }

  // Recent episodes (with outcome)
  const episodes = memoryStore.getEpisodes(maxEpisodes ?? 5)
  if (episodes.length > 0) {
    const recentParts = episodes.map((e) => {
      const outcome = e.outcome ? `(${e.outcome})` : ''
      return `${e.summary}${outcome}`
    })
    parts.push(`[Recent] ${recentParts.join(' | ')}`)
  }

  // Screen context (active window)
  if (screenContext) {
    parts.push(`[Screen] ${screenContext}`)
  }

  return parts.join('\n')
}


/** Extract meaningful keywords from user message for FTS5 search */
function extractKeywords(text: string): string[] {
  // Remove common stop words and short words
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'i', 'me', 'my', 'you', 'your', 'we', 'they', 'it', 'this', 'that',
    '帮', '请', '吗', '呢', '吧', '啊', '么', '把', '给', '让',
  ])

  const words = text.replace(/[^\u4e00-\u9fffA-Za-z0-9\s]/g, ' ').split(/\s+/)
  return words
    .filter((w) => w.length >= 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 5)
}
