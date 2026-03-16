import { toolRegistry } from './registry'

toolRegistry.register({
  name: 'get_active_window',
  description: 'Get currently focused app and window title',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const win = await window.electronAPI.getActiveWindow()
      return {
        success: true,
        data: win,
        summary: `${win.app} - ${win.title || '(no title)'}`,
      }
    } catch (err) {
      return { success: false, data: null, summary: `Failed: ${(err as Error).message}` }
    }
  },
})

toolRegistry.register({
  name: 'list_processes',
  description: 'List running apps with window titles',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const procs = await window.electronAPI.getProcessList()
      const lines = procs.map((p) => `${p.name}${p.title ? ` - ${p.title}` : ''}`).join(', ')
      return {
        success: true,
        data: procs,
        summary: `${procs.length} apps: ${lines.slice(0, 200)}`,
      }
    } catch (err) {
      return { success: false, data: null, summary: `Failed: ${(err as Error).message}` }
    }
  },
})

toolRegistry.register({
  name: 'analyze_screen',
  description: 'Detect objects and read text on screen via YOLO+OCR',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'medium',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const status = await window.electronAPI.visionStatus()
      if (!status.initialized) {
        await window.electronAPI.visionInit()
      }
      const result = await window.electronAPI.visionAnalyze()
      return {
        success: true,
        data: result,
        summary: result.summary,
      }
    } catch (err) {
      return { success: false, data: null, summary: `Failed: ${(err as Error).message}` }
    }
  },
})

toolRegistry.register({
  name: 'capture_screenshot',
  description: 'Capture screen as JPEG image',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'medium',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const dataUrl = await window.electronAPI.captureScreenshot()
      return {
        success: true,
        data: dataUrl,
        summary: 'Screenshot captured (640x360 JPEG)',
      }
    } catch (err) {
      return { success: false, data: null, summary: `Failed: ${(err as Error).message}` }
    }
  },
})
