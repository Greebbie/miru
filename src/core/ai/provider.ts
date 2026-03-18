export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]  // base64 data URLs, e.g. "data:image/jpeg;base64,..."
  tool_calls?: ToolCallRequest[]
  tool_results?: ToolResult[]
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCallRequest {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  tool_use_id: string
  content: string
}

export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'done'; stopReason: string }
  | { type: 'error'; error: string }

export interface AIProvider {
  streamChat(messages: Message[], tools?: ToolDef[], signal?: AbortSignal): AsyncIterable<StreamChunk>
}

/**
 * Format messages for Claude API — handles tool_calls and tool_results.
 */
export function formatMessagesForClaude(messages: Message[]): unknown[] {
  const result: unknown[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const content: unknown[] = []
      if (msg.content) {
        content.push({ type: 'text', text: msg.content })
      }
      for (const tc of msg.tool_calls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
      }
      result.push({ role: 'assistant', content })
    } else if (msg.role === 'user' && msg.tool_results && msg.tool_results.length > 0) {
      const content: unknown[] = msg.tool_results.map((tr) => ({
        type: 'tool_result',
        tool_use_id: tr.tool_use_id,
        content: tr.content,
      }))
      // Inject images alongside tool results (e.g. screenshot from describe_screen)
      if (msg.images?.length) {
        for (const img of msg.images) {
          const m = img.match(/^data:(image\/\w+);base64,(.+)$/)
          if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
        }
        if (msg.content) content.push({ type: 'text', text: msg.content })
      }
      result.push({ role: 'user', content })
    } else {
      if (msg.images?.length) {
        const content: unknown[] = []
        for (const img of msg.images) {
          const m = img.match(/^data:(image\/\w+);base64,(.+)$/)
          if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
        }
        if (msg.content) content.push({ type: 'text', text: msg.content })
        result.push({ role: msg.role, content })
      } else {
        result.push({ role: msg.role, content: msg.content })
      }
    }
  }
  return result
}

/**
 * Format messages for OpenAI-compatible APIs — handles tool_calls and tool_results.
 */
export function formatMessagesForOpenAI(messages: Message[]): unknown[] {
  const result: unknown[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      result.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      })
    } else if (msg.tool_results && msg.tool_results.length > 0) {
      for (const tr of msg.tool_results) {
        result.push({ role: 'tool', tool_call_id: tr.tool_use_id, content: tr.content })
      }
      // Inject image as a separate user message after tool results for OpenAI format
      if (msg.images?.length) {
        const content: unknown[] = []
        for (const img of msg.images) {
          content.push({ type: 'image_url', image_url: { url: img, detail: 'low' } })
        }
        if (msg.content) content.push({ type: 'text', text: msg.content })
        result.push({ role: 'user', content })
      }
    } else {
      if (msg.images?.length) {
        const content: unknown[] = []
        for (const img of msg.images) {
          content.push({ type: 'image_url', image_url: { url: img, detail: 'low' } })
        }
        if (msg.content) content.push({ type: 'text', text: msg.content })
        result.push({ role: msg.role, content })
      } else {
        result.push({ role: msg.role, content: msg.content })
      }
    }
  }
  return result
}
