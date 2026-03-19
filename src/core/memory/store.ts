/**
 * Three-layer memory system backed by SQLite via IPC.
 * Layers: identity (rarely changes), preferences, episodes (recent actions), facts (extracted knowledge).
 *
 * Maintains an in-memory cache for synchronous access.
 * All writes are fire-and-forget to SQLite via electronAPI.
 */

export interface IdentityMemory {
  name?: string
  language?: string
  location?: string
  editor?: string
  [key: string]: string | undefined
}

export interface PreferencesMemory {
  theme?: string
  replyStyle?: string
  favoriteTools?: string[]
  [key: string]: string | string[] | undefined
}

export interface Episode {
  timestamp: number
  summary: string
  userIntent?: string
  niromiActions?: string[]
  toolsUsed?: string[]
  outcome?: 'success' | 'partial' | 'failed' | 'cancelled'
}

export interface Fact {
  id: number
  category: string
  content: string
  confidence: number
  accessCount: number
}

interface MemoryCache {
  identity: IdentityMemory
  preferences: PreferencesMemory
  episodes: Episode[]
  facts: Fact[]
}

const LEGACY_STORE_KEY = 'niromi-memory'

let cached: MemoryCache = { identity: {}, preferences: {}, episodes: [], facts: [] }
let useSqlite = false

export const memoryStore = {
  async init() {
    // Try SQLite first — may fail if memory-db module didn't load (native deps)
    try {
      if (window.electronAPI?.memoryGetIdentity) {
        const identity = await window.electronAPI.memoryGetIdentity()
        if (!identity || typeof identity !== 'object') throw new Error('SQLite not ready')
        const prefsRaw = await window.electronAPI.memoryGetPreferences()
        const episodes = await window.electronAPI.memoryGetEpisodes(100)
        const facts = await window.electronAPI.memoryGetRecentFacts(50)

        // Parse preferences (values stored as JSON strings)
        const preferences: PreferencesMemory = {}
        for (const [k, v] of Object.entries(prefsRaw)) {
          try {
            preferences[k] = JSON.parse(v)
          } catch {
            preferences[k] = v
          }
        }

        cached = {
          identity,
          preferences,
          episodes: episodes.map((ep: { timestamp: number; summary: string; userIntent?: string; toolsUsed?: string; outcome?: string }) => ({
            timestamp: ep.timestamp,
            summary: ep.summary,
            userIntent: ep.userIntent || '',
            toolsUsed: ep.toolsUsed ? JSON.parse(ep.toolsUsed) : [],
            outcome: (ep.outcome || 'success') as Episode['outcome'],
          })),
          facts: facts || [],
        }
        useSqlite = true

        // Migrate legacy JSON data if it exists
        await this.migrateLegacy()
        return
      }
    } catch { /* fallback to JSON store */ }

    // Fallback: JSON store
    try {
      const saved = await window.electronAPI?.storeGet(LEGACY_STORE_KEY) as { identity: IdentityMemory; preferences: PreferencesMemory; episodes: Episode[] } | undefined
      if (saved) {
        cached = {
          identity: saved.identity || {},
          preferences: saved.preferences || {},
          episodes: (saved.episodes || []).map((ep: Episode) => ({
            timestamp: ep.timestamp,
            summary: ep.summary || '',
            userIntent: ep.userIntent || '',
            niromiActions: ep.niromiActions || [],
            toolsUsed: ep.toolsUsed || [],
            outcome: ep.outcome || 'success',
          })),
          facts: [],
        }
      }
    } catch { /* use default empty cache */ }
  },

  async migrateLegacy() {
    try {
      const saved = await window.electronAPI?.storeGet(LEGACY_STORE_KEY) as { identity: IdentityMemory; preferences: PreferencesMemory; episodes: Episode[] } | undefined
      if (!saved) return

      // Migrate to SQLite
      if (saved.identity) {
        for (const [k, v] of Object.entries(saved.identity)) {
          if (v) window.electronAPI?.memoryUpsertIdentity(k, v)
        }
      }
      if (saved.preferences) {
        for (const [k, v] of Object.entries(saved.preferences)) {
          if (v !== undefined) {
            window.electronAPI?.memoryUpsertPreference(k, typeof v === 'string' ? v : JSON.stringify(v))
          }
        }
      }
      if (saved.episodes) {
        for (const ep of saved.episodes.slice(-50)) {
          window.electronAPI?.memoryAddEpisode({
            summary: ep.summary,
            userIntent: ep.userIntent,
            toolsUsed: ep.toolsUsed ? JSON.stringify(ep.toolsUsed) : undefined,
            outcome: ep.outcome,
          })
        }
      }

      // Delete legacy data
      window.electronAPI?.storeDelete(LEGACY_STORE_KEY)
    } catch { /* ignore migration errors */ }
  },

  getAll(): MemoryCache {
    return cached
  },

  getIdentity(): IdentityMemory {
    return cached.identity
  },

  updateIdentity(updates: Partial<IdentityMemory>) {
    cached.identity = { ...cached.identity, ...updates }
    if (useSqlite) {
      for (const [k, v] of Object.entries(updates)) {
        if (v) window.electronAPI?.memoryUpsertIdentity(k, v)
      }
    } else {
      this.saveLegacy()
    }
  },

  getPreferences(): PreferencesMemory {
    return cached.preferences
  },

  updatePreferences(updates: Partial<PreferencesMemory>) {
    cached.preferences = { ...cached.preferences, ...updates }
    if (useSqlite) {
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) {
          window.electronAPI?.memoryUpsertPreference(k, typeof v === 'string' ? v : JSON.stringify(v))
        }
      }
    } else {
      this.saveLegacy()
    }
  },

  getEpisodes(limit = 20): Episode[] {
    return cached.episodes.slice(-limit)
  },

  addEpisode(episode: Omit<Episode, 'timestamp'> | string) {
    const ep: Episode = typeof episode === 'string'
      ? { timestamp: Date.now(), summary: episode }
      : { timestamp: Date.now(), ...episode }

    cached.episodes.push(ep)
    if (cached.episodes.length > 200) {
      cached.episodes = cached.episodes.slice(-200)
    }

    if (useSqlite) {
      window.electronAPI?.memoryAddEpisode({
        summary: ep.summary,
        userIntent: ep.userIntent,
        toolsUsed: ep.toolsUsed ? JSON.stringify(ep.toolsUsed) : undefined,
        outcome: ep.outcome,
      })
    } else {
      this.saveLegacy()
    }
  },

  getFacts(): Fact[] {
    return cached.facts
  },

  async searchFacts(query: string, limit = 10): Promise<Fact[]> {
    if (!useSqlite) return []
    try {
      const results = await window.electronAPI?.memorySearchFacts(query, limit)
      return results || []
    } catch {
      return []
    }
  },

  addFact(fact: { category: string; content: string; confidence?: number; sourceEpisodeId?: number }) {
    if (useSqlite) {
      window.electronAPI?.memoryAddFact(fact)
    }
  },

  clearEpisodes() {
    cached.episodes = []
    if (!useSqlite) this.saveLegacy()
  },

  deleteKey(layer: 'identity' | 'preferences', key: string) {
    delete cached[layer][key]
    if (!useSqlite) this.saveLegacy()
  },

  clearAll() {
    cached = { identity: {}, preferences: {}, episodes: [], facts: [] }
    window.electronAPI?.storeDelete(LEGACY_STORE_KEY)
  },

  saveLegacy() {
    window.electronAPI?.storeSet(LEGACY_STORE_KEY, {
      identity: cached.identity,
      preferences: cached.preferences,
      episodes: cached.episodes,
    })
  },
}
