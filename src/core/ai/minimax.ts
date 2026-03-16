import type { AIProvider, Message, ToolDef, StreamChunk } from './provider'
import { formatMessagesForOpenAI } from './provider'
import { parseSSE } from './streaming'
import { buildSystemPrompt } from './systemPrompt'

/**
 * Minimax AI provider — uses OpenAI-compatible message format with chatcompletion_v2.
 */
export class MinimaxProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private groupId: string,
    private model: string = 'abab6.5s-chat'
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
      messages: allMessages,
      stream: true,
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

    const response = await fetch(
      `https://api.minimax.chat/v1/text/chatcompletion_v2${this.groupId ? '?GroupId=' + this.groupId : ''}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      }
    )

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

        // Handle errors in response
        if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
          yield { type: 'error', error: data.base_resp.status_msg || 'Minimax error' }
          return
        }

        const choice = data.choices?.[0]
        if (!choice) continue

        const delta = choice.delta
        if (!delta) continue

        // Text content
        if (delta.content) {
          yield { type: 'text', text: delta.content }
        }

        // Tool calls (OpenAI format)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
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
