import { useState, useEffect, useCallback } from 'react'
import { skillRegistry } from '@/core/skills/registry'
import type { SkillDefinition } from '@/core/skills/registry'
import { useI18n } from '@/i18n/useI18n'

interface SlashMenuProps {
  filter: string
  onSelect: (skill: SkillDefinition) => void
  onClose: () => void
}

export default function SlashMenu({ filter, onSelect, onClose }: SlashMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const { t } = useI18n()
  const query = filter.startsWith('/') ? filter.slice(1) : filter
  const results = skillRegistry.search(query).slice(0, 6)

  useEffect(() => {
    setActiveIndex(0)
  }, [filter])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        onSelect(results[activeIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [results, activeIndex, onSelect, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (results.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1e1e28]/95 border border-white/10 rounded-lg overflow-hidden shadow-xl backdrop-blur-sm z-50">
        <div className="px-3 py-2 text-white/30 text-xs text-center">
          {t('slash.noMatch')}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1e1e28]/95 border border-white/10 rounded-lg overflow-hidden shadow-xl backdrop-blur-sm z-50">
      {results.map((skill, i) => (
        <button
          key={skill.id}
          className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
            i === activeIndex ? 'bg-blue-500/30 text-white' : 'text-white/70 hover:bg-white/5'
          }`}
          onMouseEnter={() => setActiveIndex(i)}
          onClick={() => onSelect(skill)}
        >
          <span className="text-base w-6 text-center">{skill.icon}</span>
          <span className="font-medium">{skill.name}</span>
          <span className="text-white/30 text-xs ml-auto">{skill.description}</span>
        </button>
      ))}
    </div>
  )
}
