import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'

toolRegistry.register({
  name: 'send_message_to_app',
  description: 'Type and send a message to a chat app',
  parameters: {
    type: 'object',
    properties: {
      app: { type: 'string', description: 'App name (e.g. 微信, WeChat, QQ, Discord)' },
      message: { type: 'string', description: 'Message text to send' },
    },
    required: ['app', 'message'],
  },
  riskLevel: 'high',
  category: 'automation',
  execute: async (params: Record<string, unknown>) => {
    const app = params.app as string
    const message = params.message as string
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好' }
    }
    try {
      // 1. Focus the target app window
      await window.electronAPI.focusWindow(app)
      // Wait for window to come to foreground
      await sleep(500)

      // 2. Write message to clipboard
      await window.electronAPI.clipboardWrite(message)
      // Wait for clipboard
      await sleep(100)

      // 3. Paste (Ctrl+V) then Enter to send
      await window.electronAPI.sendKeys('^v')
      await sleep(200)
      await window.electronAPI.sendKeys('{ENTER}')

      return {
        success: true,
        data: { app, message },
        summary: `已在 ${app} 中发送: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'type_in_app',
  description: 'Focus an app and type text without sending',
  parameters: {
    type: 'object',
    properties: {
      app: { type: 'string', description: 'App name to focus' },
      text: { type: 'string', description: 'Text to type' },
    },
    required: ['app', 'text'],
  },
  riskLevel: 'medium',
  category: 'automation',
  execute: async (params: Record<string, unknown>) => {
    const app = params.app as string
    const text = params.text as string
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好' }
    }
    try {
      await window.electronAPI.focusWindow(app)
      await sleep(500)
      await window.electronAPI.clipboardWrite(text)
      await sleep(100)
      await window.electronAPI.sendKeys('^v')

      return {
        success: true,
        data: { app, text },
        summary: `已在 ${app} 中输入文字（未发送）`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
