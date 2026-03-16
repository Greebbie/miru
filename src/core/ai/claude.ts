import type { AIProvider, Message, ToolDef, StreamChunk } from './provider'
import { formatMessagesForClaude } from './provider'
import { parseSSE } from './streaming'
import { buildSystemPrompt } from './systemPrompt'

export class ClaudeProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = 'claude-sonnet-4-20250514'
  ) {}

  async *streamChat(messages: Message[], tools?: ToolDef[], signal?: AbortSignal): AsyncIterable<StreamChunk> {
    // Extract system messages (memory/vision context) and merge into system prompt
    const extraContext = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')
    const systemPrompt = buildSystemPrompt() + (extraContext ? '\n\n' + extraContext : '')

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: formatMessagesForClaude(messages.filter((m) => m.role !== 'system')),
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }))
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
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
    let toolInputJson = ''

    for await (const event of parseSSE(response.body)) {
      if (event.data === '[DONE]') break

      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'content_block_start':
            if (data.content_block?.type === 'tool_use') {
              currentToolId = data.content_block.id
              currentToolName = data.content_block.name
              toolInputJson = ''
            }
            break

          case 'content_block_delta':
            if (data.delta?.type === 'text_delta') {
              yield { type: 'text', text: data.delta.text }
            } else if (data.delta?.type === 'input_json_delta') {
              toolInputJson += data.delta.partial_json
            }
            break

          case 'content_block_stop':
            if (currentToolId) {
              try {
                const input = toolInputJson ? JSON.parse(toolInputJson) : {}
                yield { type: 'tool_use', id: currentToolId, name: currentToolName, input }
              } catch {
                yield { type: 'tool_use', id: currentToolId, name: currentToolName, input: {} }
              }
              currentToolId = ''
              currentToolName = ''
              toolInputJson = ''
            }
            break

          case 'message_delta':
            if (data.delta?.stop_reason) {
              yield { type: 'done', stopReason: data.delta.stop_reason }
            }
            break
        }
      } catch {
        // Skip unparseable events
      }
    }
  }
}
