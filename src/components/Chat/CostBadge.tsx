import { useCostStore } from '@/stores/costStore'
import { useConfigStore } from '@/stores/configStore'

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001'
  return `~$${usd.toFixed(3)}`
}

export default function CostBadge() {
  const { lastMessageCost, sessionCost } = useCostStore()
  const provider = useConfigStore((s) => s.provider)

  if (sessionCost === 0) return null

  const tooltip = `上次消息 ${lastMessageCost !== null ? formatCost(lastMessageCost) : 'N/A'} · 本次会话合计 ${formatCost(sessionCost)}（基于 ${provider} 估算）`

  return (
    <span className="text-white/25 text-[10px] font-mono select-none" title={tooltip}>
      {lastMessageCost !== null ? `${formatCost(lastMessageCost)} · ` : ''}{formatCost(sessionCost)}
    </span>
  )
}
