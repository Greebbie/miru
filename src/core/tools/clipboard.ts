import { toolRegistry } from './registry'

toolRegistry.register({
  name: 'clipboard_read',
  description: 'Read text from clipboard',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'clipboard',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const text = await window.electronAPI.clipboardRead()
      return {
        success: true,
        data: text.slice(0, 2000),
        summary: `${text.length} chars`,
      }
    } catch (err) {
      return { success: false, data: null, summary: `Failed: ${(err as Error).message}` }
    }
  },
})

toolRegistry.register({
  name: 'clipboard_write',
  description: 'Write text to clipboard',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to copy' },
    },
    required: ['text'],
  },
  riskLevel: 'low',
  category: 'clipboard',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      await window.electronAPI.clipboardWrite(params.text as string)
      return { success: true, data: null, summary: 'Copied to clipboard' }
    } catch (err) {
      return { success: false, data: null, summary: `Failed: ${(err as Error).message}` }
    }
  },
})
