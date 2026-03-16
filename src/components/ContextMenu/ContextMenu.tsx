import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onOpenSettings: () => void
  onToggleCompact: () => void
  onOpenCommandPalette: () => void
  onOpenAdmin: () => void
}

const quickActions = [
  { label: '整理桌面', prompt: '帮我整理桌面文件，按类型分类' },
  { label: '清理下载', prompt: '列出下载文件夹中超过30天的文件' },
  { label: '今天摘要', prompt: '总结一下今天我做了什么' },
]

export default function ContextMenu({
  x, y, onClose, onOpenSettings, onToggleCompact, onOpenCommandPalette, onOpenAdmin,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Clamp position to window bounds
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 8
    const maxY = window.innerHeight - rect.height - 8
    if (x > maxX) el.style.left = `${maxX}px`
    if (y > maxY) el.style.top = `${maxY}px`
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
        background: 'rgba(30, 30, 40, 0.9)',
        backdropFilter: 'blur(16px)',
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
        onClick={() => { onOpenCommandPalette(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors flex justify-between items-center"
      >
        <span>命令面板</span>
        <span className="text-white/30 text-[10px]">Ctrl+Space</span>
      </button>

      <button
        onClick={() => { onOpenSettings(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        设置
      </button>

      <button
        onClick={() => { onToggleCompact(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        紧凑模式
      </button>

      <button
        onClick={() => { onOpenAdmin(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        管理面板
      </button>

      <button
        onClick={() => { window.electronAPI?.minimizeWindow(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        最小化
      </button>

      <div className="my-1 border-t border-white/10" />

      <button
        onClick={() => {
          const store = useChatStore.getState()
          store.openChat()
          store.setPendingPrompt('帮助')
          onClose()
        }}
        className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
      >
        帮助
      </button>
    </motion.div>
  )
}
