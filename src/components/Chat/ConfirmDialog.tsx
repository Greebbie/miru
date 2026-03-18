import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/useI18n'

interface ConfirmDialogProps {
  title: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  onConfirm: () => void
  onCancel: () => void
}

const riskColors = {
  low: 'border-green-400/50 bg-green-500/10',
  medium: 'border-yellow-400/50 bg-yellow-500/10',
  high: 'border-red-400/50 bg-red-500/10',
}

const riskLabelKeys = {
  low: 'dialog.risk.low',
  medium: 'dialog.risk.medium',
  high: 'dialog.risk.high',
} as const

export default function ConfirmDialog({
  title,
  description,
  riskLevel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`rounded-xl border p-3 my-2 ${riskColors[riskLevel]}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-white/50">{t(riskLabelKeys[riskLevel])}</span>
      </div>
      <p className="text-white text-sm font-medium mb-1">{title}</p>
      <p className="text-white/60 text-xs mb-3">{description}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className={`flex-1 text-xs py-1.5 rounded-lg text-white font-medium ${
            riskLevel === 'high'
              ? 'bg-red-500/80 hover:bg-red-500'
              : 'bg-blue-500/80 hover:bg-blue-500'
          } transition-colors`}
        >
          {t('dialog.confirm')}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
        >
          {t('dialog.cancel')}
        </button>
      </div>
    </motion.div>
  )
}
