import { create } from 'zustand'
import { calculateCost } from '@/core/ai/pricing'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10) // "2026-03-18"
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7) // "2026-03"
}

interface CostState {
  sessionTokensIn: number
  sessionTokensOut: number
  sessionCost: number
  lastMessageCost: number | null
  dailyCost: number
  dailyDate: string
  monthlyCost: number
  monthlyDate: string

  initCost: () => void
  addUsage: (tokensIn: number, tokensOut: number, provider: string, model: string) => void
  resetSession: () => void
}

function persistCost(state: CostState) {
  window.electronAPI?.storeSet('costData', {
    dailyCost: state.dailyCost,
    dailyDate: state.dailyDate,
    monthlyCost: state.monthlyCost,
    monthlyDate: state.monthlyDate,
  })
}

export const useCostStore = create<CostState>((set, get) => ({
  sessionTokensIn: 0,
  sessionTokensOut: 0,
  sessionCost: 0,
  lastMessageCost: null,
  dailyCost: 0,
  dailyDate: todayStr(),
  monthlyCost: 0,
  monthlyDate: monthStr(),

  initCost: () => {
    window.electronAPI?.storeGet('costData').then((saved) => {
      if (saved && typeof saved === 'object') {
        const data = saved as { dailyCost?: number; dailyDate?: string; monthlyCost?: number; monthlyDate?: string }
        const today = todayStr()
        const month = monthStr()

        set({
          dailyCost: data.dailyDate === today ? (data.dailyCost ?? 0) : 0,
          dailyDate: today,
          monthlyCost: data.monthlyDate === month ? (data.monthlyCost ?? 0) : 0,
          monthlyDate: month,
        })
      }
    }).catch((err) => { console.warn('[Miru] Failed to load cost data:', err) })
  },

  addUsage: (tokensIn, tokensOut, provider, model) => {
    const cost = calculateCost(tokensIn, tokensOut, provider, model)
    const today = todayStr()
    const month = monthStr()

    set((state) => {
      // Reset daily/monthly if date changed
      const dailyCost = (state.dailyDate === today ? state.dailyCost : 0) + cost
      const monthlyCost = (state.monthlyDate === month ? state.monthlyCost : 0) + cost

      const next = {
        sessionTokensIn: state.sessionTokensIn + tokensIn,
        sessionTokensOut: state.sessionTokensOut + tokensOut,
        sessionCost: state.sessionCost + cost,
        lastMessageCost: cost,
        dailyCost,
        dailyDate: today,
        monthlyCost,
        monthlyDate: month,
      }
      persistCost(next as CostState)
      return next
    })
  },

  resetSession: () => set({
    sessionTokensIn: 0,
    sessionTokensOut: 0,
    sessionCost: 0,
    lastMessageCost: null,
  }),
}))
