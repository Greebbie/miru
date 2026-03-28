import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFeedbackStore, type Toast } from '@/stores/feedbackStore'

const TOAST_DURATION_MS = 3000

const TYPE_STYLES: Record<Toast['type'], string> = {
  success: 'border-green-400/30 text-green-300',
  info: 'border-blue-400/30 text-blue-300',
  warning: 'border-yellow-400/30 text-yellow-300',
  error: 'border-red-400/30 text-red-300',
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useFeedbackStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, removeToast])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border backdrop-blur-sm select-none ${TYPE_STYLES[toast.type]}`}
      style={{
        background: 'rgba(25, 25, 35, 0.9)',
      }}
    >
      <span className="text-sm leading-none">{toast.icon}</span>
      <span className="truncate max-w-[180px]">{toast.message}</span>
    </motion.div>
  )
}

export default function ActionToast() {
  const toasts = useFeedbackStore((s) => s.toasts)

  return (
    <div className="flex flex-col items-center gap-1 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
