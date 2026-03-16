import { toolRegistry } from './registry'

toolRegistry.register({
  name: 'open_app',
  description: 'Open an application by name',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Application name (e.g. Chrome, Notepad)' },
    },
    required: ['name'],
  },
  riskLevel: 'low',
  category: 'apps',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const appName = params.name as string
      await window.electronAPI.openApp(appName)
      return { success: true, data: null, summary: `Opened ${appName}` }
    } catch (err) {
      return { success: false, data: null, summary: `Cannot open: ${(err as Error).message}` }
    }
  },
})
