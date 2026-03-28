import { create } from 'zustand'

export interface Toast {
  id: string
  icon: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  createdAt: number
}

export interface StatusPill {
  id: string
  label: string
  icon: string
  /** Which panel to open on click: 'admin' | 'quickActions' | 'settings' */
  targetPanel?: string
  /** Which scenario this pill belongs to */
  scenarioId?: string
}

interface FeedbackState {
  toasts: Toast[]
  statusPills: StatusPill[]

  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void
  removeToast: (id: string) => void
  addStatusPill: (pill: Omit<StatusPill, 'id'>) => StatusPill
  removeStatusPill: (id: string) => void
  removeStatusPillByScenario: (scenarioId: string) => void
  clearToasts: () => void
  /** Send a native OS notification (works even when minimized) */
  notifyNative: (title: string, body: string) => void
}

let toastCounter = 0
const genToastId = () => `toast-${Date.now()}-${++toastCounter}`

let pillCounter = 0
const genPillId = () => `pill-${Date.now()}-${++pillCounter}`

export const useFeedbackStore = create<FeedbackState>((set) => ({
  toasts: [],
  statusPills: [],

  addToast: (toast) => {
    const newToast: Toast = {
      ...toast,
      id: genToastId(),
      createdAt: Date.now(),
    }
    set((state) => ({
      toasts: [...state.toasts.slice(-4), newToast],
    }))
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  addStatusPill: (pill) => {
    const newPill: StatusPill = { ...pill, id: genPillId() }
    set((state) => ({
      statusPills: [...state.statusPills, newPill],
    }))
    return newPill
  },

  removeStatusPill: (id) => {
    set((state) => ({
      statusPills: state.statusPills.filter((p) => p.id !== id),
    }))
  },

  removeStatusPillByScenario: (scenarioId) => {
    set((state) => ({
      statusPills: state.statusPills.filter((p) => p.scenarioId !== scenarioId),
    }))
  },

  clearToasts: () => set({ toasts: [] }),

  notifyNative: (title, body) => {
    window.electronAPI?.nativeNotify(title, body)
  },
}))
