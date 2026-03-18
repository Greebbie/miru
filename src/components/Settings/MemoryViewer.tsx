import { useState, useRef, useCallback } from 'react'
import { memoryStore } from '@/core/memory/store'
import { useI18n } from '@/i18n/useI18n'

export default function MemoryViewer() {
  const [, forceUpdate] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { t } = useI18n()
  const refresh = () => forceUpdate((n) => n + 1)

  const handleClearClick = useCallback(() => {
    if (confirmClear) {
      memoryStore.clearEpisodes()
      setConfirmClear(false)
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      refresh()
    } else {
      setConfirmClear(true)
      confirmTimerRef.current = setTimeout(() => setConfirmClear(false), 3000)
    }
  }, [confirmClear])

  const memory = memoryStore.getAll()

  return (
    <div className="space-y-3">
      {/* Identity */}
      <Section title={t('memory.identity')}>
        {Object.entries(memory.identity).length === 0 ? (
          <Empty />
        ) : (
          Object.entries(memory.identity).map(([k, v]) => (
            <MemoryItem
              key={k}
              label={k}
              value={String(v)}
              onDelete={() => { memoryStore.deleteKey('identity', k); refresh() }}
            />
          ))
        )}
      </Section>

      {/* Preferences */}
      <Section title={t('memory.preferences')}>
        {Object.entries(memory.preferences).length === 0 ? (
          <Empty />
        ) : (
          Object.entries(memory.preferences).map(([k, v]) => (
            <MemoryItem
              key={k}
              label={k}
              value={Array.isArray(v) ? v.join(', ') : String(v)}
              onDelete={() => { memoryStore.deleteKey('preferences', k); refresh() }}
            />
          ))
        )}
      </Section>

      {/* Episodes */}
      <Section title={`${t('memory.episodes')} (${memory.episodes.length})`}>
        {memory.episodes.length === 0 ? (
          <Empty />
        ) : (
          <>
            {memory.episodes.slice(-10).reverse().map((ep, i) => (
              <div key={i} className="text-white/50 text-xs py-0.5">
                <span className="text-white/20 mr-1">
                  {new Date(ep.timestamp).toLocaleDateString()}
                </span>
                {ep.summary}
              </div>
            ))}
            <button
              onClick={handleClearClick}
              className={`text-xs mt-1 transition-colors ${
                confirmClear
                  ? 'bg-red-500/20 text-red-400 px-2 py-0.5 rounded'
                  : 'text-red-400/60 hover:text-red-400'
              }`}
            >
              {confirmClear ? t('memory.clearConfirm') : t('memory.clearAll')}
            </button>
          </>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/40 text-xs font-medium mb-1">{title}</p>
      {children}
    </div>
  )
}

function MemoryItem({ label, value, onDelete }: { label: string; value: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-0.5 group">
      <span className="text-white/70 text-xs">
        <span className="text-white/30">{label}:</span> {value}
      </span>
      <button
        onClick={onDelete}
        className="text-red-400/30 group-hover:text-red-400/60 text-xs transition-colors"
      >
        ×
      </button>
    </div>
  )
}

function Empty() {
  const { t } = useI18n()
  return <p className="text-white/20 text-xs">{t('memory.noData')}</p>
}
