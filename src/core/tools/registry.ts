import type { ToolDef } from '@/core/ai/provider'
import { useFeedbackStore } from '@/stores/feedbackStore'

export interface ToolDefinition {
  name: string
  description: string // MAX 15 words
  parameters: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high'
  category?: 'files' | 'apps' | 'system' | 'clipboard' | 'search' | 'screen' | 'automation'
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  data: unknown
  summary: string // Compressed result for LLM
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: NonNullable<ToolDefinition['category']>): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category)
  }

  getToolDefs(): ToolDef[] {
    return this.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, data: null, summary: `Tool "${name}" not found` }
    }

    // Permission check via adminStore (lazy import to avoid circular deps)
    try {
      const { useAdminStore } = await import('@/stores/adminStore')
      const store = useAdminStore.getState()
      const filePath = (params.path || params.filePath || params.dirPath || params.from) as string | undefined
      const check = store.checkPermission(name, filePath)
      if (!check.allowed) {
        return { success: false, data: null, summary: check.reason || 'Permission denied' }
      }

      // Track call count
      store.incrementCallCount(name)

      // Execute with timing
      const startTime = Date.now()
      const result = await tool.execute(params)
      const durationMs = Date.now() - startTime

      // Audit log
      store.addAuditEntry({
        timestamp: Date.now(),
        toolName: name,
        params: JSON.stringify(params).slice(0, 500),
        resultSuccess: result.success,
        resultSummary: result.summary.slice(0, 200),
        durationMs,
      })

      // Visual feedback toast
      useFeedbackStore.getState().addToast({
        icon: result.success ? '\u2705' : '\u274C',
        message: result.summary.slice(0, 60),
        type: result.success ? 'success' : 'error',
      })

      return result
    } catch {
      // If adminStore not available, execute without permission check
      return tool.execute(params)
    }
  }
}

export const toolRegistry = new ToolRegistry()
