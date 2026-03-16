import { toolRegistry } from './registry'

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
      const result = await window.electronAPI.webSearch(query)
      const lines: string[] = []
      if (result.abstract) {
        lines.push(result.abstract)
      }
      for (const r of result.results) {
        lines.push(`- **${r.title}**: ${r.snippet}`)
      }
      const text = lines.join('\n') || 'No results found'
      return {
        success: true,
        data: result,
        summary: text.slice(0, 500),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      return { success: false, data: null, summary: msg }
    }
  },
})
