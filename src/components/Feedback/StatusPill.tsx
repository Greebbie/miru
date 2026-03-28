import { AnimatePresence, motion } from 'framer-motion'
import { useFeedbackStore } from '@/stores/feedbackStore'

interface StatusPillBarProps {
  onOpenAdmin?: () => void
  onOpenQuickActions?: () => void
}

export default function StatusPillBar({ onOpenAdmin, onOpenQuickActions }: StatusPillBarProps) {
  const statusPills = useFeedbackStore((s) => s.statusPills)

  const handleClick = (targetPanel?: string) => {
    if (targetPanel === 'admin' && onOpenAdmin) {
      onOpenAdmin()
    } else if (targetPanel === 'quickActions' && onOpenQuickActions) {
      onOpenQuickActions()
    }
  }

  if (statusPills.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
      <AnimatePresence mode="popLayout">
        {statusPills.map((pill) => (
          <motion.button
            key={pill.id}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => handleClick(pill.targetPanel)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white/70 hover:text-white/90 transition-colors select-none cursor-pointer"
            style={{
              background: 'rgba(30, 30, 45, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            <span>{pill.icon}</span>
            <span className="truncate max-w-[100px]">{pill.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
