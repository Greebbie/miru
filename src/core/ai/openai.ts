import type { AIProvider, Message, ToolDef, StreamChunk } from './provider'
import { formatMessagesForOpenAI } from './provider'
import { parseSSE } from './streaming'
import { buildSystemPrompt } from './systemPrompt'

export class OpenAIProvider implements AIProvider {
  constructor(
    protected apiKey: string,
    protected model: string = 'gpt-4o',
    protected baseUrl: string = 'https://api.openai.com/v1'
  ) {}

  async *streamChat(messages: Message[], tools?: ToolDef[], signal?: AbortSignal): AsyncIterable<StreamChunk> {
    // Extract system messages (memory/vision context) and merge into system prompt
    const extraContext = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')
    const systemContent = buildSystemPrompt() + (extraContext ? '\n\n' + extraContext : '')

    const allMessages = [
      { role: 'system' as const, content: systemContent },
      ...formatMessagesForOpenAI(messages.filter((m) => m.role !== 'system')),
    ]

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 1024,
      stream: true,
      messages: allMessages,
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    // Only add Authorization when apiKey is present (Ollama/vLLM don't need it)
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      yield { type: 'error', error: `API error ${response.status}: ${errText}` }
      return
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' }
      return
    }

    let currentToolId = ''
    let currentToolName = ''
    let toolArgs = ''

    for await (const event of parseSSE(response.body)) {
      if (event.data === '[DONE]') {
        yield { type: 'done', stopReason: 'end_turn' }
        break
      }

      try {
        const data = JSON.parse(event.data)
        const choice = data.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        // Text content
        if (delta?.content) {
          yield { type: 'text', text: delta.content }
        }

        // Tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              // New tool call starting
              if (currentToolId) {
                try {
                  yield { type: 'tool_use', id: currentToolId, name: currentToolName, input: JSON.parse(toolArgs || '{}') }
                } catch {
                  yield { type: 'tool_use', id: currentToolId, name: currentToolName, input: {} }
                }
              }
              currentToolId = tc.id
              currentToolName = tc.function?.name || ''
              toolArgs = tc.function?.arguments || ''
            } else if (tc.function?.arguments) {
              toolArgs += tc.function.arguments
            }
          }
        }

        // Finish
        if (choice.finish_reason) {
          if (currentToolId) {
            try {
              yield { type: 'tool_use', id: currentToolId, name: currentToolName, input: JSON.parse(toolArgs || '{}') }
            } catch {
              yield { type: 'tool_use', id: currentToolId, name: currentToolName, input: {} }
            }
          }
          yield { type: 'done', stopReason: choice.finish_reason }
        }
      } catch {
        // Skip unparseable events
      }
    }
  }
}
