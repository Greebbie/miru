import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useConfigStore } from '@/stores/configStore'
import { useChatStore } from '@/stores/chatStore'
import { useAdminStore } from '@/stores/adminStore'
import { memoryStore } from '@/core/memory/store'
import { registerBuiltinSkills } from '@/core/skills/builtins'
import Character from '@/components/Character/Character'
import ChatBubble from '@/components/Chat/ChatBubble'
import Welcome from '@/components/Onboarding/Welcome'
import SettingsPanel from '@/components/Settings/SettingsPanel'
import CommandPalette from '@/components/CommandPalette/CommandPalette'
import ContextMenu from '@/components/ContextMenu/ContextMenu'
import AdminPanel from '@/components/Admin/AdminPanel'
import { useMonitor } from '@/hooks/useMonitor'

// Register skills once on module load
registerBuiltinSkills()

const HINT_STORAGE_KEY = 'miru-hint-shown'

export default function App() {
  const { isOnboarded, isLoading } = useConfigStore()
  const { isChatOpen } = useChatStore()
  const { isAdminOpen, setAdminOpen } = useAdminStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showHint, setShowHint] = useState(() => !localStorage.getItem(HINT_STORAGE_KEY))

  // Activate monitor system
  useMonitor()

  // Initialize persistent stores on mount
  useEffect(() => {
    useConfigStore.getState().init()
    useChatStore.getState().init()
    useAdminStore.getState().init()
    memoryStore.init()
  }, [])

  // Enable click-through on transparent pixels, forward events for hit-testing
  useEffect(() => {
    window.electronAPI?.setIgnoreCursorEvents(true, { forward: true })
  }, [])

  // Listen for command palette IPC from main process
  useEffect(() => {
    window.electronAPI?.onToggleCommandPalette(() => {
      setShowCommandPalette((v) => !v)
    })
  }, [])

  // Auto-hide hint after 10 seconds
  useEffect(() => {
    if (!showHint) return
    const timer = setTimeout(() => {
      setShowHint(false)
      localStorage.setItem(HINT_STORAGE_KEY, '1')
    }, 10000)
    return () => clearTimeout(timer)
  }, [showHint])

  const dismissHint = useCallback(() => {
    setShowHint(false)
    localStorage.setItem(HINT_STORAGE_KEY, '1')
  }, [])

  // Compact mode toggle
  const toggleCompact = useCallback(() => {
    const next = !isCompact
    setIsCompact(next)
    if (next) {
      useChatStore.getState().closeChat()
      window.electronAPI?.setWindowSize(120, 140)
    } else {
      window.electronAPI?.setWindowSize(400, 700)
    }
  }, [isCompact])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dismissHint()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [dismissHint])

  const handleCharacterClick = useCallback(() => {
    dismissHint()
  }, [dismissHint])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    )
  }

  if (!isOnboarded) {
    return (
      <div className="w-full h-full">
        <Welcome />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-end pb-4 relative">
      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && !isCompact && (
          <div className="absolute inset-0 flex items-center justify-center z-40 p-4">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Admin panel */}
      <AnimatePresence>
        {isAdminOpen && !isCompact && (
          <div className="absolute inset-0 z-50">
            <AdminPanel />
          </div>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <AnimatePresence>
        {showCommandPalette && (
          <CommandPalette onClose={() => setShowCommandPalette(false)} />
        )}
      </AnimatePresence>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onOpenSettings={() => setShowSettings(true)}
            onToggleCompact={toggleCompact}
            onOpenCommandPalette={() => setShowCommandPalette(true)}
            onOpenAdmin={() => setAdminOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* Chat bubble above character — hide in compact mode */}
      {!showSettings && !isCompact && (
        <div className="flex-1 flex items-end justify-center w-full px-4 mb-2">
          <ChatBubble onOpenSettings={() => setShowSettings(true)} onOpenAdmin={() => setAdminOpen(true)} />
        </div>
      )}

      {/* Character at bottom — double click toggles compact, right click opens menu */}
      <div onDoubleClick={toggleCompact} onContextMenu={handleContextMenu} onClick={handleCharacterClick}>
        <Character />
      </div>

      {/* First-use hint below character */}
      <AnimatePresence>
        {showHint && !isCompact && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-white/40 text-[10px] mt-1 select-none"
          >
            左键聊天 · 右键菜单 · / 查看命令
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
