import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { skillRegistry } from '@/core/skills/registry'
import type { SkillDefinition } from '@/core/skills/registry'
import { useChatStore } from '@/stores/chatStore'
import { useAI } from '@/hooks/useAI'
import { useI18n } from '@/i18n/useI18n'

interface CommandPaletteProps {
  onClose: () => void
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { sendMessage } = useAI()
  const { t } = useI18n()

  const results = skillRegistry.search(query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const executeSkill = useCallback(
    async (skill: SkillDefinition) => {
      onClose()
      if (skill.execute) {
        await skill.execute('')
      } else {
        useChatStore.getState().openChat()
        sendMessage(`${skill.name}`)
      }
    },
    [onClose, sendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        executeSkill(results[activeIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [results, activeIndex, executeSkill, onClose]
  )

  const categoryLabels: Record<string, string> = {
    files: t('cmd.cat.files'),
    apps: t('cmd.cat.apps'),
    search: t('cmd.cat.search'),
    create: t('cmd.cat.create'),
    system: t('cmd.cat.system'),
    custom: t('cmd.cat.custom'),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-start justify-center pt-16"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-[340px] max-h-[360px] rounded-xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(30, 30, 40, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-white/10">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('cmd.search')}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder:text-white/30"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {results.length === 0 ? (
            <div className="text-center text-white/30 text-sm py-6">{t('cmd.noMatch')}</div>
          ) : (
            results.map((skill, i) => (
              <button
                key={skill.id}
                className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left text-sm transition-colors ${
                  i === activeIndex ? 'bg-blue-500/30 text-white' : 'text-white/70 hover:bg-white/5'
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => executeSkill(skill)}
              >
                <span className="text-base w-6 text-center shrink-0">{skill.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{skill.name}</span>
                  <span className="text-white/30 text-xs ml-2">{skill.nameEn}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 shrink-0">
                  {categoryLabels[skill.category] || skill.category}
                </span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
