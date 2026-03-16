import { create } from 'zustand'
import { calculateCost } from '@/core/ai/pricing'

interface CostState {
  sessionTokensIn: number
  sessionTokensOut: number
  sessionCost: number
  lastMessageCost: number | null
  addUsage: (tokensIn: number, tokensOut: number, provider: string, model: string) => void
  resetSession: () => void
}

export const useCostStore = create<CostState>((set) => ({
  sessionTokensIn: 0,
  sessionTokensOut: 0,
  sessionCost: 0,
  lastMessageCost: null,

  addUsage: (tokensIn, tokensOut, provider, model) => {
    const cost = calculateCost(tokensIn, tokensOut, provider, model)
    set((state) => ({
      sessionTokensIn: state.sessionTokensIn + tokensIn,
      sessionTokensOut: state.sessionTokensOut + tokensOut,
      sessionCost: state.sessionCost + cost,
      lastMessageCost: cost,
    }))
  },

  resetSession: () => set({
    sessionTokensIn: 0,
    sessionTokensOut: 0,
    sessionCost: 0,
    lastMessageCost: null,
  }),
}))
