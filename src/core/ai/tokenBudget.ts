import type { Message } from './provider'

/**
 * Rough token estimation: English ~3.5 chars/token, CJK ~1.5 chars/token.
 */
export function estimateTokens(text: string): number {
  let cjk = 0
  let other = 0
  for (const ch of text) {
    if (ch.charCodeAt(0) > 0x2e80) {
      cjk++
    } else {
      other++
    }
  }
  return Math.ceil(cjk / 1.3 + other / 3.5)
}

/**
 * Estimate tokens for a full Message object including tool_calls/tool_results.
 */
export function estimateMessageTokens(msg: Message): number {
  let tokens = estimateTokens(msg.content)

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += estimateTokens(tc.name) + estimateTokens(JSON.stringify(tc.input))
    }
  }

  if (msg.tool_results) {
    for (const tr of msg.tool_results) {
      tokens += estimateTokens(tr.content)
    }
  }

  return tokens
}

/**
 * Keep messages from most recent backwards, staying within token budget.
 * Always keeps the first message (system/memory context) if present.
 */
export function pruneMessages(messages: Message[], budget: number): Message[] {
  if (messages.length <= 1) return messages

  // Always include the first message if it's system context
  const first = messages[0]
  const isSystemFirst = first.role === 'system'
  const rest = isSystemFirst ? messages.slice(1) : messages

  let usedTokens = isSystemFirst ? estimateMessageTokens(first) : 0
  const remaining = budget - usedTokens

  // Walk from newest to oldest, accumulate until over budget
  const kept: Message[] = []
  let total = 0
  for (let i = rest.length - 1; i >= 0; i--) {
    const msg = rest[i]
    const tokens = estimateMessageTokens(msg)
    if (total + tokens > remaining && kept.length > 0) break
    total += tokens
    kept.unshift(msg)

    // If this message has tool_results, also include the preceding assistant with tool_calls
    if (msg.tool_results && i > 0 && rest[i - 1].tool_calls) {
      const prevTokens = estimateMessageTokens(rest[i - 1])
      total += prevTokens
      kept.unshift(rest[i - 1])
      i-- // skip the message we just included
    }
  }

  return isSystemFirst ? [first, ...kept] : kept
}
