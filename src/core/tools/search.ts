import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'

toolRegistry.register({
  name: 'web_search',
  description: 'Search the web for information',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  riskLevel: 'low',
  category: 'search',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    const query = String(params.query || '')
    if (!query) {
      return { success: false, data: null, summary: 'No query provided' }
    }
    try {
      // Try DuckDuckGo API first — returns actual results for AI to use
      const result = await window.electronAPI.webSearch(query)
      if (result.abstract || result.results.length > 0) {
        const lines: string[] = []
        if (result.abstract) lines.push(result.abstract)
        for (const r of result.results) {
          lines.push(`${r.title}: ${r.snippet}`)
        }
        return {
          success: true,
          data: result,
          summary: lines.join('\n') || 'No results',
        }
      }

      // Fallback: open browser search and tell AI
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
      await window.electronAPI.openUrl(searchUrl)
      return {
        success: true,
        data: { query, url: searchUrl, fallback: true },
        summary: `已在浏览器中打开搜索「${query}」，Miru 没有找到直接的搜索结果`,
      }
    } catch (err) {
      // Last resort: open browser
      try {
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
        await window.electronAPI.openUrl(searchUrl)
        return {
          success: true,
          data: { query, url: searchUrl, fallback: true },
          summary: `已在浏览器中打开搜索「${query}」`,
        }
      } catch {
        return { success: false, data: null, summary: humanizeError(err, 'auto') }
      }
    }
  },
})
