import { startTransition } from 'react'
import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: { success: boolean; data: unknown; summary: string }
  status: 'pending' | 'running' | 'confirm' | 'done' | 'error'
}

export interface PendingConfirm {
  toolName: string
  params: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
  description?: string
  onConfirm: () => void
  onCancel: () => void
}

interface ChatState {
  messages: Message[]
  isStreaming: boolean
  isChatOpen: boolean
  pendingConfirm: PendingConfirm | null
  pendingPrompt: string | null

  init: () => void
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  appendToLastMessage: (text: string) => void
  updateMessage: (id: string, update: Partial<Message>) => void
  addToolCallToMessage: (messageId: string, toolCall: ToolCall) => void
  updateToolCall: (messageId: string, toolCallId: string, update: Partial<ToolCall>) => void
  setStreaming: (streaming: boolean) => void
  setPendingPrompt: (prompt: string | null) => void
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  deleteMessage: (id: string) => void
  clearMessages: () => void
  setPendingConfirm: (confirm: PendingConfirm | null) => void
}

let msgCounter = 0
const genId = () => `msg-${Date.now()}-${++msgCounter}`

const MAX_PERSISTED_MESSAGES = 50

let persistTimer: ReturnType<typeof setTimeout> | null = null

function persistMessages(messages: Message[], immediate = false) {
  const doSave = () => {
    persistTimer = null
    const toSave = messages.slice(-MAX_PERSISTED_MESSAGES).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      toolCalls: m.toolCalls,
    }))
    window.electronAPI?.storeSet('chatMessages', toSave)
  }

  if (immediate) {
    if (persistTimer !== null) clearTimeout(persistTimer)
    doSave()
  } else {
    // Debounce: wait 500ms before writing to disk
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(doSave, 500)
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  isChatOpen: false,
  pendingConfirm: null,
  pendingPrompt: null,

  init: () => {
    window.electronAPI?.storeGet('chatMessages').then((saved) => {
      if (Array.isArray(saved) && saved.length > 0) {
        set({ messages: saved as Message[] })
      }
    }).catch((err) => { console.warn('[Miru] Failed to load chat history:', err) })
  },

  addMessage: (msg) => {
    const id = genId()
    set((state) => {
      const messages = [...state.messages, { ...msg, id, timestamp: Date.now() }]
      persistMessages(messages)
      return { messages }
    })
    return id
  },

  appendToLastMessage: (text) => {
    set((state) => {
      const msgs = [...state.messages]
      if (msgs.length === 0) return state
      const last = { ...msgs[msgs.length - 1] }
      last.content += text
      msgs[msgs.length - 1] = last
      return { messages: msgs }
    })
    // Persist less frequently for streaming — debounced by caller or on done
  },

  updateMessage: (id, update) => {
    set((state) => {
      const messages = state.messages.map((m) => (m.id === id ? { ...m, ...update } : m))
      persistMessages(messages)
      return { messages }
    })
  },

  addToolCallToMessage: (messageId, toolCall) => {
    set((state) => {
      const messages = state.messages.map((m) => {
        if (m.id !== messageId) return m
        const toolCalls = [...(m.toolCalls || []), toolCall]
        return { ...m, toolCalls }
      })
      return { messages }
    })
  },

  updateToolCall: (messageId, toolCallId, update) => {
    set((state) => {
      const messages = state.messages.map((m) => {
        if (m.id !== messageId || !m.toolCalls) return m
        const toolCalls = m.toolCalls.map((tc) =>
          tc.id === toolCallId ? { ...tc, ...update } : tc
        )
        return { ...m, toolCalls }
      })
      persistMessages(messages)
      return { messages }
    })
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming })
    // Persist immediately when streaming ends
    if (!streaming) {
      persistMessages(get().messages, true)
    }
  },
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  toggleChat: () => startTransition(() => set((s) => ({ isChatOpen: !s.isChatOpen }))),
  openChat: () => startTransition(() => set({ isChatOpen: true })),
  closeChat: () => set({ isChatOpen: false }),
  deleteMessage: (id) => {
    set((state) => {
      const messages = state.messages.filter((m) => m.id !== id)
      persistMessages(messages)
      return { messages }
    })
  },
  clearMessages: () => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    set({ messages: [] })
    window.electronAPI?.storeSet('chatMessages', [])
  },
  setPendingConfirm: (pendingConfirm) => set({ pendingConfirm }),
}))
