import { useState } from 'react'
import { useCostStore } from '@/stores/costStore'
import { useConfigStore } from '@/stores/configStore'
import { useI18n } from '@/i18n/useI18n'

function formatCost(usd: number): string {
  if (usd === 0) return '$0'
  if (usd < 0.001) return '<$0.001'
  return `~$${usd.toFixed(3)}`
}

const FREE_PROVIDERS = new Set(['ollama', 'vllm'])

export default function CostBadge() {
  const [open, setOpen] = useState(false)
  const { lastMessageCost, sessionCost, dailyCost, monthlyCost } = useCostStore()
  const provider = useConfigStore((s) => s.provider)
  const model = useConfigStore((s) => s.model)

  const { t } = useI18n()

  if (sessionCost === 0 && !FREE_PROVIDERS.has(provider)) return null

  const isFree = FREE_PROVIDERS.has(provider)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-white/50 text-[10px] font-mono select-none hover:text-white/70 transition-colors"
      >
        {isFree ? t('cost.free') : (
          <>
            {lastMessageCost !== null ? `${formatCost(lastMessageCost)} · ` : ''}
            {formatCost(sessionCost)}
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-50 rounded-lg p-2.5 min-w-[160px]"
            style={{
              background: 'rgba(20, 20, 30, 0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5">
              {provider} · {model.slice(0, 20)}
            </div>
            {isFree ? (
              <div className="text-green-400/80 text-[11px]">{t('cost.freeLocal')}</div>
            ) : (
              <div className="space-y-1 text-[11px]">
                <Row label={t('cost.lastMessage')} value={lastMessageCost !== null ? formatCost(lastMessageCost) : '-'} />
                <Row label={t('cost.session')} value={formatCost(sessionCost)} />
                <div className="border-t border-white/5 my-1" />
                <Row label={t('cost.today')} value={formatCost(dailyCost)} />
                <Row label={t('cost.month')} value={formatCost(monthlyCost)} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className="text-white/70 font-mono">{value}</span>
    </div>
  )
}
