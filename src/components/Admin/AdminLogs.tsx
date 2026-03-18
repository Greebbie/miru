import { useState, useEffect, useRef, useMemo } from 'react'
import { useAdminStore, type AuditEntry } from '@/stores/adminStore'
import { useI18n } from '@/i18n/useI18n'

export default function AdminLogs() {
  const auditLog = useAdminStore((s) => s.auditLog)
  const clearAuditLog = useAdminStore((s) => s.clearAuditLog)
  const { t } = useI18n()

  const [filterTool, setFilterTool] = useState<string>('')
  const [filterSuccess, setFilterSuccess] = useState<'' | 'true' | 'false'>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get unique tool names for filter dropdown
  const toolNames = useMemo(() => {
    const names = new Set(auditLog.map((e) => e.toolName))
    return Array.from(names).sort()
  }, [auditLog])

  // Filtered log
  const filteredLog = useMemo(() => {
    let log = auditLog
    if (filterTool) {
      log = log.filter((e) => e.toolName === filterTool)
    }
    if (filterSuccess === 'true') {
      log = log.filter((e) => e.resultSuccess)
    } else if (filterSuccess === 'false') {
      log = log.filter((e) => !e.resultSuccess)
    }
    return log
  }, [auditLog, filterTool, filterSuccess])

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLog.length])

  function formatTime(ts: number): string {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  function truncate(s: string | undefined, max: number): string {
    if (!s) return '--'
    return s.length > max ? s.slice(0, max) + '...' : s
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <select
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          className="log-select"
        >
          <option value="">{t('admin.logs.allTools')}</option>
          {toolNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={filterSuccess}
          onChange={(e) => setFilterSuccess(e.target.value as '' | 'true' | 'false')}
          className="log-select"
        >
          <option value="">{t('admin.logs.allResults')}</option>
          <option value="true">{t('admin.logs.success')}</option>
          <option value="false">{t('admin.logs.failed')}</option>
        </select>

        <div className="flex-1" />

        <span className="text-white/30 text-xs">{filteredLog.length} {t('admin.logs.entries')}</span>

        <button
          onClick={clearAuditLog}
          className="px-3 py-1 rounded-lg text-xs bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          {t('admin.logs.clear')}
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[100px_90px_1fr_1fr_60px] gap-2 px-3 py-1.5 text-white/30 text-xs border-b border-white/5">
        <span>{t('admin.logs.time')}</span>
        <span>{t('admin.logs.tool')}</span>
        <span>{t('admin.logs.params')}</span>
        <span>{t('admin.logs.result')}</span>
        <span>{t('admin.logs.ms')}</span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="max-h-[360px] overflow-y-auto space-y-0.5"
      >
        {filteredLog.map((entry) => (
          <LogRow key={entry.id} entry={entry} truncate={truncate} formatTime={formatTime} />
        ))}

        {filteredLog.length === 0 && (
          <p className="text-white/30 text-xs text-center py-8">{t('admin.logs.noEntries')}</p>
        )}
      </div>

      <style>{`
        .log-select {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.6);
          font-size: 0.75rem;
          border-radius: 0.375rem;
          padding: 0.25rem 0.5rem;
          border: 1px solid rgba(255,255,255,0.08);
          outline: none;
        }
        .log-select:focus {
          border-color: rgba(96,165,250,0.5);
        }
        .log-select option {
          background: #1e1e28;
          color: rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  )
}

function LogRow({
  entry,
  truncate,
  formatTime,
}: {
  entry: AuditEntry
  truncate: (s: string | undefined, max: number) => string
  formatTime: (ts: number) => string
}) {
  return (
    <div
      className={`grid grid-cols-[100px_90px_1fr_1fr_60px] gap-2 px-3 py-1.5 rounded items-center text-xs ${
        entry.resultSuccess ? 'hover:bg-white/5' : 'bg-red-500/5 hover:bg-red-500/10'
      }`}
    >
      <span className="text-white/30 font-mono">{formatTime(entry.timestamp)}</span>
      <span className="text-white/60 truncate">{entry.toolName}</span>
      <span className="text-white/30 truncate" title={entry.params}>
        {truncate(entry.params, 40)}
      </span>
      <span
        className={`truncate ${entry.resultSuccess ? 'text-green-400/60' : 'text-red-400/60'}`}
        title={entry.resultSummary}
      >
        {entry.resultSuccess ? 'OK' : 'FAIL'}: {truncate(entry.resultSummary, 35)}
      </span>
      <span className="text-white/30 text-right">{entry.durationMs}</span>
    </div>
  )
}
