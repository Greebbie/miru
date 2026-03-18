import type { AIProviderType } from '@/stores/configStore'

/**
 * Test API connection with a minimal request.
 * Returns null on success, error string on failure.
 */
export async function testConnection(
  provider: AIProviderType,
  apiKey: string,
  baseUrl: string,
  groupId: string
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    switch (provider) {
      case 'claude': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: controller.signal,
        })
        if (res.status === 401 || res.status === 403) return '401'
        if (!res.ok && res.status >= 500) return String(res.status)
        return null
      }

      case 'openai':
      case 'deepseek':
      case 'qwen': {
        const urls: Record<string, string> = {
          openai: 'https://api.openai.com/v1/chat/completions',
          deepseek: 'https://api.deepseek.com/v1/chat/completions',
          qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        }
        const models: Record<string, string> = {
          openai: 'gpt-4o-mini',
          deepseek: 'deepseek-chat',
          qwen: 'qwen-turbo',
        }
        const res = await fetch(urls[provider], {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: models[provider],
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: controller.signal,
        })
        if (res.status === 401 || res.status === 403) return '401'
        if (!res.ok && res.status >= 500) return String(res.status)
        return null
      }

      case 'minimax': {
        if (!groupId) return 'GroupId required'
        const url = `https://api.minimax.chat/v1/text/chatcompletion_v2?GroupId=${groupId}`
        const reqOptions = {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'MiniMax-M2.5',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        }

        // Try proxy first (bypasses CORS), fallback to direct fetch
        const api = window.electronAPI
        try {
          let status: number
          let body = ''
          if (api?.proxyFetch) {
            const res = await api.proxyFetch(url, reqOptions)
            status = res.status
            body = res.body
          } else {
            const res = await fetch(url, { ...reqOptions, signal: controller.signal })
            status = res.status
            body = await res.text()
          }
          if (status === 401 || status === 403) return '401'
          if (status >= 500) return String(status)
          // Minimax returns 200 even on errors — check body
          try {
            const parsed = JSON.parse(body)
            if (parsed.base_resp?.status_code && parsed.base_resp.status_code !== 0) {
              return parsed.base_resp.status_msg || `Minimax error ${parsed.base_resp.status_code}`
            }
          } catch { /* body parse failed, likely still ok */ }
          if (status >= 400) return String(status)
          return null
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[Miru] Minimax test failed:', msg)
          return msg || 'fetch failed'
        }
      }

      case 'ollama': {
        const url = (baseUrl || 'http://localhost:11434/v1').replace(/\/v1\/?$/, '')
        const res = await fetch(`${url}/api/tags`, { signal: controller.signal })
        if (!res.ok) return 'fetch failed'
        return null
      }

      case 'vllm': {
        const url = baseUrl || 'http://localhost:8000/v1'
        const res = await fetch(`${url}/models`, { signal: controller.signal })
        if (!res.ok) return 'fetch failed'
        return null
      }

      default:
        return null
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Miru] testConnection(${provider}) failed:`, errMsg)
    if (err instanceof DOMException && err.name === 'AbortError') return 'timeout'
    return errMsg || 'fetch failed'
  } finally {
    clearTimeout(timeout)
  }
}
