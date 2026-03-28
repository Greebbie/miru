import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { useI18n } from '@/i18n/useI18n'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onOpenSettings: () => void
  onToggleCompact: () => void
  onOpenCommandPalette: () => void
  onOpenAdmin: () => void
  onOpenQuickActions: () => void
}

export default function ContextMenu({
  x, y, onClose, onOpenSettings, onToggleCompact, onOpenCommandPalette, onOpenAdmin, onOpenQuickActions,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  const quickActions = [
    { label: t('ctx.organizeDesktop'), prompt: t('ctx.organizeDesktop') },
    { label: t('ctx.cleanDownloads'), prompt: t('ctx.cleanDownloads') },
    { label: t('ctx.todaySummary'), prompt: t('ctx.todaySummary') },
  ]

  // Clamp position to window bounds (after first render measures size)
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    // Force layout to get accurate dimensions
    const rect = el.getBoundingClientRect()
    const clampedX = Math.min(x, window.innerWidth - rect.width - 8)
    const clampedY = Math.min(y, window.innerHeight - rect.height - 8)
    el.style.left = `${Math.max(4, clampedX)}px`
    el.style.top = `${Math.max(4, clampedY)}px`
  }, [x, y])

  // Close on Esc or click outside
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const handleQuickAction = (prompt: string) => {
    const store = useChatStore.getState()
    store.openChat()
    store.setPendingPrompt(prompt)
    onClose()
  }

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[100] min-w-[180px] py-1.5 rounded-xl overflow-hidden"
      style={{
        left: x,
        top: y,
        background: 'rgba(30, 30, 40, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Quick actions */}
      {quickActions.map((a) => (
        <button
          key={a.label}
          onClick={() => handleQuickAction(a.prompt)}
          className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
        >
          {a.label}
        </button>
      ))}

      {/* Separator */}
      <div className="my-1 border-t border-white/10" />

      <button
        onClick={() => { onOpenQuickActions(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('qa.title')}
      </button>

      <button
        onClick={() => { onOpenCommandPalette(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors flex justify-between items-center"
      >
        <span>{t('ctx.commandPalette')}</span>
        <span className="text-white/30 text-[10px]">Ctrl+Space</span>
      </button>

      <button
        onClick={() => { onOpenSettings(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('ctx.settings')}
      </button>

      <button
        onClick={() => { onToggleCompact(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('ctx.compactMode')}
      </button>

      <button
        onClick={() => { onOpenAdmin(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('ctx.adminPanel')}
      </button>

      <button
        onClick={() => { window.electronAPI?.minimizeWindow(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('ctx.minimize')}
      </button>

      <div className="my-1 border-t border-white/10" />

      <button
        onClick={() => {
          const store = useChatStore.getState()
          store.openChat()
          store.setPendingPrompt(t('ctx.help'))
          onClose()
        }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        {t('ctx.help')}
      </button>
    </motion.div>
  )
}
