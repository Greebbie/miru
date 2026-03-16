import { create } from 'zustand'

interface ToolPermission {
  toolName: string
  enabled: boolean
  requireConfirm: boolean
  allowedPaths?: string[]
  blockedPaths?: string[]
  dailyLimit?: number
  callCount: number
}

interface MonitorRule {
  id: string
  name: string
  enabled: boolean
  trigger: {
    type: 'app_focus' | 'window_title'
    pattern: string
    app?: string
  }
  action: {
    type: 'notify' | 'auto_reply' | 'run_tool' | 'run_skill'
    payload: string
    params?: Record<string, unknown>
  }
  cooldownMs: number
  lastTriggered?: number
}

interface AutoReplyRule {
  id: string
  name: string
  enabled: boolean
  app: 'wechat' | 'discord' | 'telegram' | 'outlook' | 'other'
  contactPattern?: string
  triggerKeywords?: string[]
  replyTemplate?: string
  useAI: boolean
  idleMinutes?: number
  requireConfirm: boolean
}

interface AuditEntry {
  id: number
  timestamp: number
  toolName: string
  params?: string
  resultSuccess: boolean
  resultSummary: string
  durationMs: number
}

interface AdminState {
  permissions: ToolPermission[]
  monitorRules: MonitorRule[]
  autoReplyRules: AutoReplyRule[]
  auditLog: AuditEntry[]
  isAdminOpen: boolean

  init: () => void
  setAdminOpen: (open: boolean) => void

  // Permissions
  updatePermission: (toolName: string, updates: Partial<ToolPermission>) => void
  getPermission: (toolName: string) => ToolPermission | undefined
  checkPermission: (toolName: string, filePath?: string) => { allowed: boolean; reason?: string }
  incrementCallCount: (toolName: string) => void
  resetDailyCounts: () => void

  // Monitor rules
  addMonitorRule: (rule: Omit<MonitorRule, 'id'>) => void
  updateMonitorRule: (id: string, updates: Partial<MonitorRule>) => void
  deleteMonitorRule: (id: string) => void

  // Auto reply rules
  addAutoReplyRule: (rule: Omit<AutoReplyRule, 'id'>) => void
  updateAutoReplyRule: (id: string, updates: Partial<AutoReplyRule>) => void
  deleteAutoReplyRule: (id: string) => void

  // Audit
  addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => void
  getAuditLog: (filter?: { toolName?: string; success?: boolean; limit?: number }) => AuditEntry[]
  clearAuditLog: () => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function persistConfig(state: AdminState) {
  window.electronAPI?.storeSet('admin-config', {
    permissions: state.permissions,
    monitorRules: state.monitorRules,
    autoReplyRules: state.autoReplyRules,
  })
}

function persistAudit(auditLog: AuditEntry[]) {
  window.electronAPI?.storeSet('admin-audit', auditLog)
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

export const useAdminStore = create<AdminState>((set, get) => ({
  permissions: [],
  monitorRules: [],
  autoReplyRules: [],
  auditLog: [],
  isAdminOpen: false,

  init: async () => {
    try {
      const config = await window.electronAPI?.storeGet('admin-config') as {
        permissions?: ToolPermission[]
        monitorRules?: MonitorRule[]
        autoReplyRules?: AutoReplyRule[]
      } | undefined

      const audit = await window.electronAPI?.storeGet('admin-audit') as AuditEntry[] | undefined

      set({
        permissions: config?.permissions ?? [],
        monitorRules: config?.monitorRules ?? [],
        autoReplyRules: config?.autoReplyRules ?? [],
        auditLog: audit ?? [],
      })
    } catch {
      // Silent fail, use defaults
    }
  },

  setAdminOpen: (open) => set({ isAdminOpen: open }),

  // Permissions
  updatePermission: (toolName, updates) => {
    set((state) => {
      const idx = state.permissions.findIndex((p) => p.toolName === toolName)
      const newPerms = [...state.permissions]
      if (idx >= 0) {
        newPerms[idx] = { ...newPerms[idx], ...updates }
      } else {
        newPerms.push({
          toolName,
          enabled: true,
          requireConfirm: false,
          callCount: 0,
          ...updates,
        })
      }
      const newState = { ...state, permissions: newPerms }
      persistConfig(newState)
      return { permissions: newPerms }
    })
  },

  getPermission: (toolName) => {
    return get().permissions.find((p) => p.toolName === toolName)
  },

  checkPermission: (toolName, filePath?) => {
    const perm = get().permissions.find((p) => p.toolName === toolName)

    // No permission entry means allowed by default
    if (!perm) return { allowed: true }

    if (!perm.enabled) {
      return { allowed: false, reason: `Tool "${toolName}" is disabled` }
    }

    if (perm.dailyLimit !== undefined && perm.callCount >= perm.dailyLimit) {
      return { allowed: false, reason: `Daily limit reached (${perm.dailyLimit})` }
    }

    if (filePath) {
      const normalized = normalizePath(filePath)

      if (perm.blockedPaths && perm.blockedPaths.length > 0) {
        const blocked = perm.blockedPaths.some((bp) => normalized.startsWith(normalizePath(bp)))
        if (blocked) {
          return { allowed: false, reason: `Path is blocked: ${filePath}` }
        }
      }

      if (perm.allowedPaths && perm.allowedPaths.length > 0) {
        const allowed = perm.allowedPaths.some((ap) => normalized.startsWith(normalizePath(ap)))
        if (!allowed) {
          return { allowed: false, reason: `Path not in allowed list: ${filePath}` }
        }
      }
    }

    return { allowed: true }
  },

  incrementCallCount: (toolName) => {
    set((state) => {
      const newPerms = state.permissions.map((p) =>
        p.toolName === toolName ? { ...p, callCount: p.callCount + 1 } : p
      )
      const newState = { ...state, permissions: newPerms }
      persistConfig(newState)
      return { permissions: newPerms }
    })
  },

  resetDailyCounts: () => {
    set((state) => {
      const newPerms = state.permissions.map((p) => ({ ...p, callCount: 0 }))
      const newState = { ...state, permissions: newPerms }
      persistConfig(newState)
      return { permissions: newPerms }
    })
  },

  // Monitor rules
  addMonitorRule: (rule) => {
    set((state) => {
      const newRule: MonitorRule = { ...rule, id: generateId() }
      const newRules = [...state.monitorRules, newRule]
      const newState = { ...state, monitorRules: newRules }
      persistConfig(newState)
      return { monitorRules: newRules }
    })
  },

  updateMonitorRule: (id, updates) => {
    set((state) => {
      const newRules = state.monitorRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      )
      const newState = { ...state, monitorRules: newRules }
      persistConfig(newState)
      return { monitorRules: newRules }
    })
  },

  deleteMonitorRule: (id) => {
    set((state) => {
      const newRules = state.monitorRules.filter((r) => r.id !== id)
      const newState = { ...state, monitorRules: newRules }
      persistConfig(newState)
      return { monitorRules: newRules }
    })
  },

  // Auto reply rules
  addAutoReplyRule: (rule) => {
    set((state) => {
      const newRule: AutoReplyRule = { ...rule, id: generateId() }
      const newRules = [...state.autoReplyRules, newRule]
      const newState = { ...state, autoReplyRules: newRules }
      persistConfig(newState)
      return { autoReplyRules: newRules }
    })
  },

  updateAutoReplyRule: (id, updates) => {
    set((state) => {
      const newRules = state.autoReplyRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      )
      const newState = { ...state, autoReplyRules: newRules }
      persistConfig(newState)
      return { autoReplyRules: newRules }
    })
  },

  deleteAutoReplyRule: (id) => {
    set((state) => {
      const newRules = state.autoReplyRules.filter((r) => r.id !== id)
      const newState = { ...state, autoReplyRules: newRules }
      persistConfig(newState)
      return { autoReplyRules: newRules }
    })
  },

  // Audit
  addAuditEntry: (entry) => {
    set((state) => {
      const newEntry: AuditEntry = { ...entry, id: Date.now() }
      const newLog = [...state.auditLog, newEntry].slice(-500)
      persistAudit(newLog)
      return { auditLog: newLog }
    })
  },

  getAuditLog: (filter?) => {
    let log = get().auditLog

    if (filter?.toolName) {
      log = log.filter((e) => e.toolName === filter.toolName)
    }
    if (filter?.success !== undefined) {
      log = log.filter((e) => e.resultSuccess === filter.success)
    }
    if (filter?.limit) {
      log = log.slice(-filter.limit)
    }

    return log
  },

  clearAuditLog: () => {
    persistAudit([])
    set({ auditLog: [] })
  },
}))

export type { ToolPermission, MonitorRule, AutoReplyRule, AuditEntry, AdminState }
