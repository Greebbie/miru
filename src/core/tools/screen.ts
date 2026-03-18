import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'
import { isVisionCapable } from '@/core/ai/createProvider'

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
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
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
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'analyze_screen',
  description: 'Detect objects and read text on screen via YOLO+OCR',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const status = await window.electronAPI.visionStatus()
      if (!status.initialized) {
        const initResult = await window.electronAPI.visionInit()
        if (!initResult.success) {
          return { success: false, data: null, summary: '视觉模型未就绪，请在设置中下载 / Vision not ready, download in Settings' }
        }
      }
      const result = await window.electronAPI.visionAnalyze()
      if (result.summary === 'Vision not initialized') {
        return { success: false, data: null, summary: '视觉模型加载失败，请在设置中重新下载' }
      }
      return {
        success: true,
        data: result,
        summary: result.summary,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'describe_screen',
  description: 'Capture screen and let AI describe it',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好' }
    }
    try {
      // If provider supports vision, send screenshot to AI
      if (isVisionCapable()) {
        const dataUrl = await window.electronAPI.captureScreenshot()
        return {
          success: true,
          data: { _image: dataUrl },
          summary: '[截图已捕获]',
        }
      }
      // Fallback: YOLO+OCR for non-vision providers
      const status = await window.electronAPI.visionStatus()
      if (!status.initialized) {
        const initResult = await window.electronAPI.visionInit()
        if (!initResult.success) {
          return { success: false, data: null, summary: '视觉模型未就绪，请在设置中下载 / Vision not ready, download in Settings' }
        }
      }
      const result = await window.electronAPI.visionAnalyze()
      if (result.summary === 'Vision not initialized') {
        return { success: false, data: null, summary: '视觉模型加载失败，请在设置中重新下载' }
      }
      return {
        success: true,
        data: result,
        summary: result.summary,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'analyze_active_window',
  description: 'Analyze active window content via OCR',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const win = await window.electronAPI.getActiveWindow()
      const status = await window.electronAPI.visionStatus()
      if (!status.initialized) {
        const initResult = await window.electronAPI.visionInit()
        if (!initResult.success) {
          return { success: false, data: null, summary: '视觉模型未就绪，请在设置中下载 / Vision not ready, download in Settings' }
        }
      }
      const result = await window.electronAPI.visionAnalyzeWindow(win.app)
      return {
        success: true,
        data: result,
        summary: `${win.app}: ${result.summary}`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'capture_screenshot',
  description: 'Capture screen as JPEG image',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
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
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})
