import { useState } from 'react'
import { toolRegistry, type ToolDefinition } from '@/core/tools/registry'
import { useAdminStore, type ToolPermission } from '@/stores/adminStore'
import { useI18n } from '@/i18n/useI18n'

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
}

const FILE_CATEGORIES = ['files']

export default function AdminTools() {
  const tools = toolRegistry.getAll()
  const permissions = useAdminStore((s) => s.permissions)
  const updatePermission = useAdminStore((s) => s.updatePermission)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const { t } = useI18n()

  function getPerm(toolName: string): ToolPermission {
    const existing = permissions.find((p) => p.toolName === toolName)
    return existing ?? {
      toolName,
      enabled: true,
      requireConfirm: false,
      callCount: 0,
    }
  }

  function toggleEnabled(tool: ToolDefinition) {
    const perm = getPerm(tool.name)
    updatePermission(tool.name, { enabled: !perm.enabled })
  }

  function toggleConfirm(tool: ToolDefinition) {
    const perm = getPerm(tool.name)
    updatePermission(tool.name, { requireConfirm: !perm.requireConfirm })
  }

  function setDailyLimit(tool: ToolDefinition, value: string) {
    const num = value === '' ? undefined : parseInt(value)
    updatePermission(tool.name, {
      dailyLimit: num !== undefined && !isNaN(num) ? num : undefined,
    })
  }

  function setAllowedPaths(toolName: string, value: string) {
    const paths = value.split('\n').map((s) => s.trim()).filter(Boolean)
    updatePermission(toolName, { allowedPaths: paths.length > 0 ? paths : undefined })
  }

  function setBlockedPaths(toolName: string, value: string) {
    const paths = value.split('\n').map((s) => s.trim()).filter(Boolean)
    updatePermission(toolName, { blockedPaths: paths.length > 0 ? paths : undefined })
  }

  const isFileTool = (tool: ToolDefinition) => FILE_CATEGORIES.includes(tool.category ?? '')

  return (
    <div className="space-y-1">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_70px_50px_60px_70px_60px] gap-2 px-3 py-2 text-white/30 text-xs border-b border-white/5">
        <span>{t('admin.tools.tool')}</span>
        <span>{t('admin.tools.risk')}</span>
        <span>{t('admin.tools.on')}</span>
        <span>{t('admin.tools.confirm')}</span>
        <span>{t('admin.tools.limit')}</span>
        <span>{t('admin.tools.calls')}</span>
      </div>

      {/* Tool rows */}
      {tools.map((tool) => {
        const perm = getPerm(tool.name)
        const isExpanded = expandedTool === tool.name
        const showExpand = isFileTool(tool)

        return (
          <div key={tool.name}>
            <div
              className={`grid grid-cols-[1fr_70px_50px_60px_70px_60px] gap-2 px-3 py-2 items-center rounded-lg transition-colors ${
                perm.enabled ? 'hover:bg-white/5' : 'opacity-50'
              }`}
            >
              {/* Name */}
              <div className="flex items-center gap-2">
                {showExpand && (
                  <button
                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                    className="text-white/30 hover:text-white/60 text-xs w-4"
                  >
                    {isExpanded ? 'v' : '>'}
                  </button>
                )}
                <span className="text-white/70 text-xs truncate">{tool.name}</span>
              </div>

              {/* Risk badge */}
              <span
                className={`text-xs px-2 py-0.5 rounded-full text-center ${
                  RISK_COLORS[tool.riskLevel] ?? 'bg-white/10 text-white/40'
                }`}
              >
                {tool.riskLevel}
              </span>

              {/* Enabled toggle */}
              <button
                onClick={() => toggleEnabled(tool)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  perm.enabled ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                    perm.enabled ? 'left-4' : 'left-0.5'
                  }`}
                />
              </button>

              {/* Confirm toggle */}
              <button
                onClick={() => toggleConfirm(tool)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  perm.requireConfirm ? 'bg-yellow-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                    perm.requireConfirm ? 'left-4' : 'left-0.5'
                  }`}
                />
              </button>

              {/* Daily limit */}
              <input
                type="number"
                min={0}
                value={perm.dailyLimit ?? ''}
                onChange={(e) => setDailyLimit(tool, e.target.value)}
                placeholder="--"
                className="w-full bg-white/5 text-white/70 text-xs rounded px-2 py-1 border border-white/5 outline-none focus:border-blue-400/50"
              />

              {/* Call count */}
              <span className="text-white/40 text-xs text-center">{perm.callCount}</span>
            </div>

            {/* Expanded path settings for file tools */}
            {isExpanded && showExpand && (
              <div className="ml-8 mr-3 mb-2 p-3 rounded-lg bg-white/5 space-y-2">
                <div>
                  <label className="text-white/40 text-xs block mb-1">{t('admin.tools.allowedPaths')}</label>
                  <textarea
                    rows={2}
                    value={(perm.allowedPaths ?? []).join('\n')}
                    onChange={(e) => setAllowedPaths(tool.name, e.target.value)}
                    placeholder="C:/Users/... (leave empty = allow all)"
                    className="w-full bg-white/5 text-white/60 text-xs rounded px-2 py-1.5 border border-white/5 outline-none focus:border-blue-400/50 resize-none"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs block mb-1">{t('admin.tools.blockedPaths')}</label>
                  <textarea
                    rows={2}
                    value={(perm.blockedPaths ?? []).join('\n')}
                    onChange={(e) => setBlockedPaths(tool.name, e.target.value)}
                    placeholder="C:/Windows/System32 ..."
                    className="w-full bg-white/5 text-white/60 text-xs rounded px-2 py-1.5 border border-white/5 outline-none focus:border-blue-400/50 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {tools.length === 0 && (
        <p className="text-white/30 text-xs text-center py-8">{t('admin.tools.noTools')}</p>
      )}
    </div>
  )
}
