import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'

toolRegistry.register({
  name: 'run_shell',
  description: 'Execute a shell command (requires confirmation)',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
    },
    required: ['command'],
  },
  riskLevel: 'high',
  category: 'system',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Niromi 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const command = params.command as string
      const { stdout, stderr } = await window.electronAPI.runShell(command)
      const output = stdout || ''
      const lines = output.split('\n').length
      return {
        success: true,
        data: { stdout: output, stderr: stderr || '' },
        summary: `OK, ${lines} lines output${stderr ? ' (with warnings)' : ''}`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})
