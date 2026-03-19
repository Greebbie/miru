import { toolRegistry } from './registry'

const reminders = new Map<string, NodeJS.Timeout>()

toolRegistry.register({
  name: 'set_reminder',
  description: 'Set a timed reminder with notification',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Reminder message' },
      minutes: { type: 'number', description: 'Minutes from now' },
    },
    required: ['message', 'minutes'],
  },
  riskLevel: 'low',
  category: 'system',
  execute: async (params) => {
    const message = params.message as string
    const minutes = params.minutes as number
    const id = `reminder-${Date.now()}`

    // Request notification permission if not yet granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    const timer = setTimeout(() => {
      // Use Notification API
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Niromi 提醒你~', { body: message })
      }
      reminders.delete(id)
    }, minutes * 60 * 1000)

    reminders.set(id, timer)

    return {
      success: true,
      data: { id, triggerAt: new Date(Date.now() + minutes * 60 * 1000).toISOString() },
      summary: `Reminder set for ${minutes}min: "${message.slice(0, 30)}"`,
    }
  },
})
