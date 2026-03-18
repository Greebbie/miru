import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { useConfigStore } from '@/stores/configStore'
import { useMonitorStatus } from '@/hooks/useMonitor'
import { useI18n } from '@/i18n/useI18n'
import MessageList from './MessageList'
import InputBar from './InputBar'
import CostBadge from './CostBadge'
import ConfirmDialog from './ConfirmDialog'
import { createPortal } from 'react-dom'
import VisionPanel from './VisionPanel'

interface ChatBubbleProps {
  onOpenSettings: () => void
  onOpenAdmin: () => void
}

export default function ChatBubble({ onOpenSettings, onOpenAdmin }: ChatBubbleProps) {
  const { isChatOpen, pendingConfirm, closeChat } = useChatStore()
  const { visionTarget } = useConfigStore()
  const [showVisionPanel, setShowVisionPanel] = useState(false)
  const eyeBtnRef = useRef<HTMLButtonElement>(null)
  const visionPanelRef = useRef<HTMLDivElement>(null)
  const hasActiveRules = useMonitorStatus()
  const { t } = useI18n()

  // Close VisionPanel when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      visionPanelRef.current && !visionPanelRef.current.contains(e.target as Node) &&
      eyeBtnRef.current && !eyeBtnRef.current.contains(e.target as Node)
    ) {
      setShowVisionPanel(false)
    }
  }, [])

  useEffect(() => {
    if (showVisionPanel) {
      document.addEventListener('pointerdown', handleClickOutside, true)
      return () => document.removeEventListener('pointerdown', handleClickOutside, true)
    }
  }, [showVisionPanel, handleClickOutside])

  const visionEnabled = visionTarget !== 'off'
  const eyeColor = visionTarget === 'off'
    ? 'text-white/30'
    : visionTarget === 'fullscreen'
      ? 'text-blue-400'
      : 'text-green-400'

  return (
    <>
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-[350px] max-h-[400px] rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(30, 30, 40, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="text-white/70 text-xs font-medium">Miru</span>
                {hasActiveRules && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="Monitor active" />}
                <CostBadge />
              </div>
              <div className="flex items-center gap-1">
                <button
                  ref={eyeBtnRef}
                  onClick={() => setShowVisionPanel(!showVisionPanel)}
                  className={`w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-xs transition-colors ${eyeColor}`}
                  title={visionEnabled ? t('bubble.vision.off') : t('bubble.vision.on')}
                >
                  {'\uD83D\uDC41'}
                </button>
                <button
                  onClick={onOpenAdmin}
                  className="w-6 h-6 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center text-xs transition-colors"
                  title={t('bubble.admin')}
                >
                  {'\u2630'}
                </button>
                <button
                  onClick={onOpenSettings}
                  className="w-6 h-6 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center text-xs transition-colors"
                  title={t('bubble.settings')}
                >
                  {'\u2699'}
                </button>
                <button
                  onClick={closeChat}
                  className="w-6 h-6 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center text-xs transition-colors"
                  title={t('bubble.close')}
                >
                  {'\u00D7'}
                </button>
              </div>
            </div>

            <MessageList onOpenAdmin={onOpenAdmin} />

            {/* Confirm dialog */}
            {pendingConfirm && (
              <div className="px-3 py-2 border-t border-white/10">
                <ConfirmDialog
                  title={pendingConfirm.toolName}
                  description={pendingConfirm.description || pendingConfirm.toolName}
                  riskLevel={pendingConfirm.riskLevel || 'medium'}
                  onConfirm={pendingConfirm.onConfirm}
                  onCancel={pendingConfirm.onCancel}
                />
              </div>
            )}

            <InputBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* VisionPanel rendered via portal to escape overflow-hidden */}
      {showVisionPanel && eyeBtnRef.current && createPortal(
        <VisionPanel
          ref={visionPanelRef}
          anchorEl={eyeBtnRef.current}
          onClose={() => setShowVisionPanel(false)}
        />,
        document.body,
      )}
    </>
  )
}
