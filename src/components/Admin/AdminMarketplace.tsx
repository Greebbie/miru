import { useState, useEffect, useMemo } from 'react'
import { useMarketplaceStore } from '@/stores/marketplaceStore'
import { useSkillConfigStore } from '@/stores/skillConfigStore'
import { useI18n } from '@/i18n/useI18n'
import { skillRegistry } from '@/core/skills/registry'
import type { SkillDefinition } from '@/core/skills/registry'
import type { MarketplaceIndexEntry } from '@/core/skills/marketplace'

type FilterTab = 'installed' | 'all' | 'local' | 'openclaw'

interface UnifiedSkill {
  id: string
  name: string
  nameEn: string
  icon: string
  category: string
  description: string
  author: string
  version: string
  source: string
  riskLevel: string
  tags: string[]
  repoUrl?: string
  /** The original SkillDefinition if builtin */
  _def?: SkillDefinition
}

export default function AdminMarketplace() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('installed')
  const [installing, setInstalling] = useState<string | null>(null)
  const [confirmHigh, setConfirmHigh] = useState<string | null>(null)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)

  const skillConfigs = useSkillConfigStore((s) => s.configs)
  const setSkillEnabled = useSkillConfigStore((s) => s.setEnabled)
  const setSkillConfig = useSkillConfigStore((s) => s.setConfig)

  const {
    remoteSkills,
    installedSkills,
    isFetching,
    init,
    fetchIndex,
    install,
    uninstall,
    isInstalled,
  } = useMarketplaceStore()

  useEffect(() => {
    init()
    fetchIndex()
    useSkillConfigStore.getState().init()
  }, [init, fetchIndex])

  // Build unified skill list
  const allSkills = useMemo((): UnifiedSkill[] => {
    const builtins: UnifiedSkill[] = skillRegistry.getAll().map(s => ({
      id: s.id,
      name: s.name,
      nameEn: s.nameEn,
      icon: s.icon,
      category: s.category,
      description: s.description,
      author: 'niromi-team',
      version: '1.0.0',
      source: 'builtin',
      riskLevel: 'low',
      tags: s.keywords,
      _def: s,
    }))

    const remote: UnifiedSkill[] = remoteSkills.map(s => ({
      id: s.id,
      name: s.name,
      nameEn: s.nameEn,
      icon: s.icon,
      category: s.category,
      description: s.description,
      author: s.author,
      version: s.version,
      source: s.source,
      riskLevel: s.riskLevel,
      tags: s.tags,
      repoUrl: s.repoUrl,
    }))

    // Merge: builtins + remote (dedup by id)
    const map = new Map<string, UnifiedSkill>()
    for (const s of builtins) map.set(s.id, s)
    for (const s of remote) {
      if (!map.has(s.id)) map.set(s.id, s)
    }

    return Array.from(map.values())
  }, [remoteSkills])

  // Filter
  const filtered = useMemo(() => {
    let list = allSkills

    // Tab filter
    if (tab === 'installed') {
      const installedIds = new Set(installedSkills.map(s => s.id))
      // Include builtins + installed
      list = list.filter(s => s.source === 'builtin' || installedIds.has(s.id))
    } else if (tab === 'local') {
      const installedIds = new Set(installedSkills.filter(s => s.source === 'local').map(s => s.id))
      list = list.filter(s => installedIds.has(s.id))
    } else if (tab === 'openclaw') {
      list = list.filter(s => s.source === 'openclaw')
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    return list
  }, [allSkills, tab, search, installedSkills])

  const handleInstall = async (skill: UnifiedSkill) => {
    if (skill.riskLevel === 'high' && confirmHigh !== skill.id) {
      setConfirmHigh(skill.id)
      return
    }
    setConfirmHigh(null)
    setInstalling(skill.id)
    await install(skill as unknown as MarketplaceIndexEntry)
    setInstalling(null)
  }

  const handleUninstall = async (skillId: string) => {
    await uninstall(skillId)
  }

  const handleToggleConfigurable = (skill: UnifiedSkill) => {
    const def = skill._def
    if (!def?.configurable) return

    const entry = skillConfigs[skill.id]

    // Initialize config with defaults if first time
    if (!entry?.config || Object.keys(entry.config).length === 0) {
      setSkillConfig(skill.id, { ...(def.defaultConfig || {}) })
    }

    // Execute handles the toggle (reads current state, flips it, activates/deactivates)
    def.execute?.('')
  }

  const handleConfigChange = (skillId: string, config: Record<string, unknown>) => {
    setSkillConfig(skillId, config)
  }

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'installed', label: t('marketplace.tab.installed') },
    { id: 'all', label: t('marketplace.tab.all') },
    { id: 'local', label: t('marketplace.tab.local') },
    { id: 'openclaw', label: 'OpenClaw' },
  ]

  return (
    <div className="space-y-3">
      {/* Search + Refresh */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('marketplace.search')}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-400/50"
        />
        <button
          onClick={() => fetchIndex()}
          disabled={isFetching}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs hover:bg-white/10 disabled:opacity-50"
        >
          {isFetching ? '...' : t('marketplace.refresh')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {TABS.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`px-3 py-1 rounded-md text-xs transition-colors ${
              tab === tabItem.id
                ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Skill list */}
      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="text-white/30 text-xs text-center py-8">
            {t('marketplace.empty')}
          </div>
        )}
        {filtered.map(skill => {
          const installed = skill.source === 'builtin' || isInstalled(skill.id)
          const isBuiltin = skill.source === 'builtin'
          const def = skill._def
          const isConfigurable = def?.configurable ?? false
          const configEntry = skillConfigs[skill.id]
          const isEnabled = configEntry?.enabled ?? false
          const isExpanded = expandedSkill === skill.id
          const ConfigPanel = def?.ConfigPanel

          return (
            <div key={skill.id} className="rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-start gap-3 p-3">
                <span className="text-lg mt-0.5">{skill.icon}</span>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => isConfigurable && setExpandedSkill(isExpanded ? null : skill.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-medium">{skill.name}</span>
                    <span className="text-white/30 text-[10px]">v{skill.version}</span>
                    {isConfigurable && (
                      <span className="text-[10px] px-1 rounded bg-purple-500/20 text-purple-300">
                        {t('skill.config.configurable')}
                      </span>
                    )}
                  </div>
                  <div className="text-white/40 text-[11px] mt-0.5 truncate">
                    {skill.description}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/20 text-[10px]">{skill.author}</span>
                    <span className={`text-[10px] px-1 rounded ${
                      skill.riskLevel === 'high' ? 'bg-red-500/20 text-red-300' :
                      skill.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-green-500/20 text-green-300'
                    }`}>
                      {skill.riskLevel}
                    </span>
                    <span className="text-white/20 text-[10px]">{skill.source}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Configurable skill toggle */}
                  {isConfigurable && (
                    <button
                      onClick={() => handleToggleConfigurable(skill)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${
                        isEnabled ? 'bg-blue-500' : 'bg-white/10'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                  {/* Standard install/uninstall buttons */}
                  {!isConfigurable && isBuiltin ? (
                    <span className="text-white/20 text-[10px] px-2 py-1">
                      {t('marketplace.builtin')}
                    </span>
                  ) : !isConfigurable && installed ? (
                    <button
                      onClick={() => handleUninstall(skill.id)}
                      className="text-red-300/60 hover:text-red-300 text-[11px] px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    >
                      {t('marketplace.uninstall')}
                    </button>
                  ) : !isConfigurable && installing === skill.id ? (
                    <span className="text-blue-300/60 text-[11px] px-2 py-1">
                      {t('marketplace.installing')}
                    </span>
                  ) : !isConfigurable && confirmHigh === skill.id ? (
                    <button
                      onClick={() => handleInstall(skill)}
                      className="text-red-300 text-[11px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      {t('marketplace.confirmHigh')}
                    </button>
                  ) : !isConfigurable ? (
                    <button
                      onClick={() => handleInstall(skill)}
                      className="text-blue-300/60 hover:text-blue-300 text-[11px] px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                    >
                      {t('marketplace.install')}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Expanded config panel */}
              {isConfigurable && isExpanded && ConfigPanel && (
                <div className="px-3 pb-3 pt-0 ml-8 border-t border-white/5">
                  <div className="pt-3">
                    <ConfigPanel
                      config={configEntry?.config || def?.defaultConfig || {}}
                      onChange={(config) => handleConfigChange(skill.id, config)}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
