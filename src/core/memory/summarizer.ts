import type { Message } from '@/stores/chatStore'

/**
 * Heuristic conversation summarizer — no AI needed.
 * Takes first user message topic + tool call stats + final outcome.
 * Output: "整理桌面截图，移动了7个文件，成功"
 */
export function summarizeConversation(messages: Message[]): {
  summary: string
  userIntent: string
  niromiActions: string[]
  toolsUsed: string[]
  outcome: 'success' | 'partial' | 'failed' | 'cancelled'
} {
  const userMessages = messages.filter((m) => m.role === 'user')
  const assistantMessages = messages.filter((m) => m.role === 'assistant')

  // User intent: first user message that triggered interaction (truncate 60 chars)
  const firstUser = userMessages[0]
  const userIntent = firstUser
    ? firstUser.content.slice(0, 60).replace(/\n/g, ' ').trim()
    : ''

  // Collect tool calls from all messages
  const allToolCalls = messages.flatMap((m) => m.toolCalls || [])
  const toolsUsed = [...new Set(allToolCalls.map((tc) => tc.name))]

  // Extract niromi actions from assistant summary lines (📎 ...)
  const niromiActions: string[] = []
  for (const msg of assistantMessages) {
    const lines = msg.content.split('\n')
    for (const line of lines) {
      const match = line.match(/📎\s*(.+)/)
      if (match) niromiActions.push(match[1].trim())
    }
  }

  // Determine outcome from last tool call status
  let outcome: 'success' | 'partial' | 'failed' | 'cancelled' = 'success'
  if (allToolCalls.length > 0) {
    const last = allToolCalls[allToolCalls.length - 1]
    if (last.status === 'error') outcome = 'failed'
    else if (last.result && !last.result.success) outcome = 'failed'
  }

  // Build summary
  const parts: string[] = []
  if (userIntent) parts.push(userIntent)
  if (toolsUsed.length > 0) parts.push(`使用了${toolsUsed.join(',')}`)
  parts.push(outcome === 'success' ? '成功' : outcome === 'failed' ? '失败' : outcome)

  return {
    summary: parts.join('，'),
    userIntent,
    niromiActions,
    toolsUsed,
    outcome,
  }
}
