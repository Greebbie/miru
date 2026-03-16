import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { useConfigStore } from '@/stores/configStore'
import { useMonitorStatus } from '@/hooks/useMonitor'
import MessageList from './MessageList'
import InputBar from './InputBar'
import CostBadge from './CostBadge'

interface ChatBubbleProps {
  onOpenSettings: () => void
  onOpenAdmin: () => void
}

export default function ChatBubble({ onOpenSettings, onOpenAdmin }: ChatBubbleProps) {
  const { isChatOpen, pendingConfirm, closeChat } = useChatStore()
  const { visionEnabled, setVisionEnabled } = useConfigStore()
  const hasActiveRules = useMonitorStatus()

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-[350px] max-h-[400px] rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'rgba(30, 30, 40, 0.85)',
            backdropFilter: 'blur(12px)',
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
                onClick={() => setVisionEnabled(!visionEnabled)}
                className={`w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-xs transition-colors ${
                  visionEnabled ? 'text-blue-400' : 'text-white/30'
                }`}
                title={visionEnabled ? '关闭视觉模式 — 零 token（仅读窗口标题）' : '开启视觉模式 — 每次分析 ~200 tokens'}
              >
                {'\uD83D\uDC41'}
              </button>
              <button
                onClick={onOpenAdmin}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center text-xs transition-colors"
                title="管理面板"
              >
                {'\u2630'}
              </button>
              <button
                onClick={onOpenSettings}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center text-xs transition-colors"
                title="设置"
              >
                {'\u2699'}
              </button>
              <button
                onClick={closeChat}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center text-xs transition-colors"
                title="关闭"
              >
                {'\u00D7'}
              </button>
            </div>
          </div>

          <MessageList onOpenAdmin={onOpenAdmin} />

          {/* Confirm dialog */}
          {pendingConfirm && (
            <div className="px-3 py-2 border-t border-white/10 bg-yellow-500/10">
              <p className="text-white/80 text-xs mb-2">
                {'\u26A0\uFE0F'} 确认执行 <span className="font-mono text-yellow-300">{pendingConfirm.toolName}</span>？
              </p>
              <div className="flex gap-2">
                <button
                  onClick={pendingConfirm.onConfirm}
                  className="flex-1 py-1 rounded-lg text-xs bg-blue-500/80 text-white hover:bg-blue-500 transition-colors"
                >
                  确认
                </button>
                <button
                  onClick={pendingConfirm.onCancel}
                  className="flex-1 py-1 rounded-lg text-xs bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <InputBar />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
