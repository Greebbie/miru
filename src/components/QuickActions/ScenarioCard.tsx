import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ScenarioCardProps {
  icon: string
  title: string
  description: string
  isActive: boolean
  onToggle: () => void
  /** Optional expandable config content */
  children?: React.ReactNode
}

export default function ScenarioCard({
  icon,
  title,
  description,
  isActive,
  onToggle,
  children,
}: ScenarioCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{
        background: isActive ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${isActive ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-lg leading-none">{icon}</span>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => children && setExpanded(!expanded)}
        >
          <div className="text-xs font-medium text-white/90 truncate">{title}</div>
          <div className="text-[10px] text-white/50 truncate">{description}</div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={onToggle}
          className="relative w-8 h-4 rounded-full transition-colors shrink-0"
          style={{
            background: isActive ? 'rgba(74, 222, 128, 0.6)' : 'rgba(255, 255, 255, 0.15)',
          }}
        >
          <motion.div
            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm"
            animate={{ left: isActive ? 16 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Expandable config area */}
      <AnimatePresence>
        {expanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-white/5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
