import { create } from 'zustand'
import type { MarketplaceIndexEntry, InstalledSkillRecord } from '@/core/skills/marketplace'
import { installSkill, uninstallSkill, fetchMarketplaceIndex } from '@/core/skills/loader'

interface MarketplaceState {
  remoteSkills: MarketplaceIndexEntry[]
  installedSkills: InstalledSkillRecord[]
  isFetching: boolean
  lastFetched: number | null

  init: () => Promise<void>
  fetchIndex: () => Promise<void>
  install: (entry: MarketplaceIndexEntry) => Promise<boolean>
  uninstall: (skillId: string) => Promise<void>
  isInstalled: (id: string) => boolean
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  remoteSkills: [],
  installedSkills: [],
  isFetching: false,
  lastFetched: null,

  init: async () => {
    const installed = (await window.electronAPI.storeGet('marketplace-installed')) as InstalledSkillRecord[] | null
    set({ installedSkills: installed || [] })
  },

  fetchIndex: async () => {
    set({ isFetching: true })
    try {
      const index = await fetchMarketplaceIndex()
      set({
        remoteSkills: index.skills,
        lastFetched: Date.now(),
        isFetching: false,
      })
    } catch {
      set({ isFetching: false })
    }
  },

  install: async (entry: MarketplaceIndexEntry) => {
    const success = await installSkill(entry)
    if (success) {
      const installed = (await window.electronAPI.storeGet('marketplace-installed')) as InstalledSkillRecord[] | null
      set({ installedSkills: installed || [] })
    }
    return success
  },

  uninstall: async (skillId: string) => {
    await uninstallSkill(skillId)
    const installed = (await window.electronAPI.storeGet('marketplace-installed')) as InstalledSkillRecord[] | null
    set({ installedSkills: installed || [] })
  },

  isInstalled: (id: string) => {
    return get().installedSkills.some(s => s.id === id)
  },
}))
