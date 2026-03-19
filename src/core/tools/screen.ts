import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'
import { isVisionCapable } from '@/core/ai/createProvider'
import { useConfigStore } from '@/stores/configStore'

toolRegistry.register({
  name: 'get_active_window',
  description: 'Get currently focused app and window title',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好，请稍后再试' }
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
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好，请稍后再试' }
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
  name: 'describe_screen',
  description: 'Capture screen and let AI describe it',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'screen',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好' }
    }
    const { visionTarget } = useConfigStore.getState()
    if (visionTarget === 'off') {
      return { success: false, data: null, summary: '视觉功能已关闭，请在聊天窗口点击眼睛图标开启' }
    }
    if (!isVisionCapable()) {
      return { success: false, data: null, summary: '当前模型不支持视觉，请切换到支持视觉的模型' }
    }
    try {
      // Use visionTarget to decide capture method
      const dataUrl = (visionTarget !== 'fullscreen')
        ? await window.electronAPI.captureWindow(visionTarget)
        : await window.electronAPI.captureScreenshot()
      return {
        success: true,
        data: { _image: dataUrl },
        summary: '[截图已捕获，等待 AI 分析]',
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'describe_window',
  description: 'Capture specific window and let AI describe it',
  parameters: {
    type: 'object',
    properties: {
      window_name: { type: 'string', description: 'Window name to capture' },
    },
    required: ['window_name'],
  },
  riskLevel: 'low',
  category: 'screen',
  execute: async (params: Record<string, unknown>) => {
    const windowName = params.window_name as string
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好' }
    }
    if (!isVisionCapable()) {
      return { success: false, data: null, summary: '当前模型不支持视觉，请切换到支持视觉的模型' }
    }
    try {
      const dataUrl = await window.electronAPI.captureWindow(windowName)
      return {
        success: true,
        data: { _image: dataUrl },
        summary: '[窗口截图已捕获，等待 AI 分析]',
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
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好，请稍后再试' }
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

toolRegistry.register({
  name: 'capture_window',
  description: 'Capture specific window as JPEG image',
  parameters: {
    type: 'object',
    properties: {
      window_name: { type: 'string', description: 'Window name' },
    },
    required: ['window_name'],
  },
  riskLevel: 'low',
  category: 'screen',
  execute: async (params: Record<string, unknown>) => {
    const windowName = params.window_name as string
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const dataUrl = await window.electronAPI.captureWindow(windowName)
      return {
        success: true,
        data: dataUrl,
        summary: `窗口 "${windowName}" 截图完成`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})
