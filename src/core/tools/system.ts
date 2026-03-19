import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'

toolRegistry.register({
  name: 'get_system_info',
  description: 'Get OS, CPU, memory, battery, network, disk info',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'low',
  category: 'system',
  execute: async () => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const info = await window.electronAPI.getSystemInfo()
      const parts = [
        `${info.platform} | ${info.cpus} cores | ${info.freeMem}/${info.totalMem} free`,
      ]
      if (info.battery) {
        parts.push(`battery:${info.battery.percent}%${info.battery.charging ? '⚡' : ''}`)
      }
      if (info.network.connected) {
        parts.push(`net:${info.network.ip}`)
      }
      if (info.disks.length > 0) {
        const diskStr = info.disks.map((d) => `${d.name}:${d.freeGB}GB free`).join(',')
        parts.push(`disk:${diskStr}`)
      }
      return {
        success: true,
        data: info,
        summary: parts.join(' | '),
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})
