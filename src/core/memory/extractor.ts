import { memoryStore } from './store'
import type { Message } from '@/stores/chatStore'
import { summarizeConversation } from './summarizer'
import { useConfigStore } from '@/stores/configStore'

/**
 * Extract user info, facts, and episode summaries from a conversation.
 * Scans full conversation for identity/preferences + builds rich episodes + extracts facts.
 */
export function extractFromConversation(messages: Message[]) {
  const userMessages = messages.filter((m) => m.role === 'user')
  const assistantMsgs = messages.filter((m) => m.role === 'assistant' && m.content.length > 0)
  const rounds = Math.min(userMessages.length, assistantMsgs.length)
  if (rounds < 3) return

  // --- Identity & Preferences extraction ---
  for (const msg of userMessages) {
    const text = msg.content

    // Name
    const nameMatch = text.match(/(?:我(?:叫|是)|my name is|call me)\s*(\S+)/i)
    if (nameMatch) {
      memoryStore.updateIdentity({ name: nameMatch[1] })
      if (!useConfigStore.getState().userName) {
        useConfigStore.getState().updateConfig({ userName: nameMatch[1] })
      }
    }

    // Language
    if (/[\u4e00-\u9fff]/.test(text)) {
      memoryStore.updateIdentity({ language: 'zh' })
    } else if (/^[a-zA-Z\s.,!?]+$/.test(text)) {
      memoryStore.updateIdentity({ language: 'en' })
    }

    // Editor
    const editorMatch = text.match(/(用|使用|use|using)\s*(VS\s*Code|Cursor|Vim|Neovim|Emacs|Sublime|WebStorm|IntelliJ|PyCharm)/i)
    if (editorMatch) {
      memoryStore.updateIdentity({ editor: editorMatch[2] })
    }

    // Location
    const locationMatch = text.match(/(我在|I'm in|I live in|来自|from)\s*(.{2,20}?)([，。,.!?]|$)/i)
    if (locationMatch) {
      memoryStore.updateIdentity({ location: locationMatch[2].trim() })
    }

    // Occupation
    const jobMatch = text.match(/我是\s*(程序员|设计师|学生|工程师|产品经理|教师|医生|律师|研究员|开发者|前端|后端|全栈)/i)
    if (jobMatch) {
      memoryStore.updateIdentity({ occupation: jobMatch[1] })
    }
    const jobMatchEn = text.match(/I(?:'m| am) (?:a |an )?(developer|designer|student|engineer|teacher|doctor|researcher|programmer)/i)
    if (jobMatchEn) {
      memoryStore.updateIdentity({ occupation: jobMatchEn[1] })
    }

    // Theme preference
    const themeMatch = text.match(/(喜欢|prefer|用|use)\s*(dark|light|暗色|亮色|深色|浅色)/i)
    if (themeMatch) {
      const raw = themeMatch[2].toLowerCase()
      const theme = (raw === 'dark' || raw === '暗色' || raw === '深色') ? 'dark' : 'light'
      memoryStore.updatePreferences({ theme })
    }

    // Interests
    const interestMatch = text.match(/(学习|learning|working on|研究|studying)\s*(.{3,30}?)([，。,.!?]|$)/i)
    if (interestMatch) {
      const topic = interestMatch[2].trim()
      const prefs = memoryStore.getPreferences()
      const existing = (prefs.interests as string[] | undefined) || []
      if (!existing.includes(topic)) {
        memoryStore.updatePreferences({ interests: [...existing, topic].slice(-10) })
      }
    }

    // --- Fact extraction from user messages ---
    extractFacts(text)
  }

  // --- Episode construction (full conversation scan) ---
  const { summary, userIntent, niromiActions, toolsUsed, outcome } = summarizeConversation(messages)

  // Only store episode if there was meaningful interaction
  if (userIntent) {
    memoryStore.addEpisode({ summary, userIntent, niromiActions, toolsUsed, outcome })
  }

  // --- Frequency statistics ---
  if (toolsUsed.length > 0) {
    const prefs = memoryStore.getPreferences()
    const freqMap: Record<string, number> = {}
    const existing = (prefs.frequentTools as string[] | undefined) || []
    for (const t of existing) freqMap[t] = (freqMap[t] || 0) + 1
    for (const t of toolsUsed) freqMap[t] = (freqMap[t] || 0) + 1

    // Keep top 5 most used tools
    const sorted = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)
    memoryStore.updatePreferences({ frequentTools: sorted })
  }

  // --- Audit log for tool calls ---
  const allToolCalls = messages.flatMap((m) => m.toolCalls || [])
  for (const tc of allToolCalls) {
    if (tc.status === 'done' || tc.status === 'error') {
      try {
        window.electronAPI?.memoryAddAudit({
          timestamp: Date.now(),
          toolName: tc.name,
          params: JSON.stringify(tc.input).slice(0, 500),
          resultSuccess: tc.result?.success ?? false,
          resultSummary: tc.result?.summary?.slice(0, 200) ?? '',
          durationMs: 0, // Not tracked at this level
        })
      } catch { /* ignore */ }
    }
  }
}

/**
 * Extract facts from user text using pattern matching.
 * Patterns: "我用X", "我的项目是Y", "我喜欢Z", "I use X", "my project is Y"
 */
function extractFacts(text: string) {
  const factPatterns: { pattern: RegExp; category: 'user' | 'project' | 'workflow' | 'preference' }[] = [
    // Chinese patterns
    { pattern: /我(?:在)?用\s*(.{2,30}?)(?:[，。,.!?]|$)/g, category: 'user' },
    { pattern: /我的项目(?:是|叫)\s*(.{2,30}?)(?:[，。,.!?]|$)/g, category: 'project' },
    { pattern: /我(?:喜欢|偏好)\s*(.{2,30}?)(?:[，。,.!?]|$)/g, category: 'preference' },
    { pattern: /我(?:正在|最近在)\s*(.{2,40}?)(?:[，。,.!?]|$)/g, category: 'project' },
    { pattern: /我们(?:团队|公司)(?:用|使用)\s*(.{2,30}?)(?:[，。,.!?]|$)/g, category: 'workflow' },
    // English patterns
    { pattern: /I (?:use|am using)\s+(.{2,30}?)(?:[,.\-!?]|$)/gi, category: 'user' },
    { pattern: /my project (?:is|called)\s+(.{2,30}?)(?:[,.\-!?]|$)/gi, category: 'project' },
    { pattern: /I (?:prefer|like)\s+(.{2,30}?)(?:[,.\-!?]|$)/gi, category: 'preference' },
    { pattern: /I(?:'m| am) (?:working on|building)\s+(.{2,40}?)(?:[,.\-!?]|$)/gi, category: 'project' },
    { pattern: /(?:our|we) (?:team|company) (?:uses?|works? with)\s+(.{2,30}?)(?:[,.\-!?]|$)/gi, category: 'workflow' },
  ]

  for (const { pattern, category } of factPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const content = match[1].trim()
      if (content.length >= 2) {
        memoryStore.addFact({ category, content, confidence: 0.8 })
      }
    }
  }
}
