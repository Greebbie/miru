import type { AIProvider, Message, ToolDef, StreamChunk } from './provider'
import { formatMessagesForOpenAI } from './provider'
import { parseSSE } from './streaming'
import { buildSystemPrompt } from './systemPrompt'

/**
 * Create a ReadableStream from IPC proxy stream events.
 */
function createProxyStream(streamId: string): { stream: ReadableStream<Uint8Array>; cleanup: () => void } {
  const api = window.electronAPI
  let cleanups: (() => void)[] = []

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()

      cleanups.push(api.onProxyStreamData((id, data) => {
        if (id === streamId) {
          controller.enqueue(encoder.encode(data))
        }
      }))

      cleanups.push(api.onProxyStreamEnd((id) => {
        if (id === streamId) {
          try { controller.close() } catch { /* already closed */ }
        }
      }))

      cleanups.push(api.onProxyStreamError((id, error) => {
        if (id === streamId) {
          try { controller.error(new Error(error)) } catch { /* already closed */ }
        }
      }))
    },
  })

  return {
    stream,
    cleanup: () => { cleanups.forEach(fn => fn()); cleanups = [] },
  }
}

/**
 * Minimax AI provider — routes through main process IPC proxy to bypass CORS.
 */
export class MinimaxProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private groupId: string,
    private model: string = 'MiniMax-M2.5'
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

    const api = window.electronAPI
    if (!api?.proxyStream) {
      yield { type: 'error', error: 'Proxy not available' }
      return
    }

    const url = `https://api.minimax.chat/v1/text/chatcompletion_v2${this.groupId ? '?GroupId=' + this.groupId : ''}`
    const result = await api.proxyStream(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if ('error' in result) {
      yield { type: 'error', error: result.error }
      return
    }

    const { streamId } = result

    // Handle abort
    if (signal) {
      const onAbort = () => api.proxyStreamAbort(streamId)
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const { stream, cleanup } = createProxyStream(streamId)

    try {
      let currentToolId = ''
      let currentToolName = ''
      let toolArgs = ''

      for await (const event of parseSSE(stream)) {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Don't yield error for abort
      if (!msg.includes('abort')) {
        yield { type: 'error', error: msg }
      }
    } finally {
      cleanup()
    }
  }
}
