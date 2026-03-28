import { create } from 'zustand'

interface CommandQueue {
  ruleId: string
  commands: string[]
  currentIndex: number
  paused: boolean
}

interface CommandQueueState {
  queues: CommandQueue[]

  /** Create or replace a queue for a rule */
  setQueue: (ruleId: string, commands: string[]) => void
  /** Pop next command from queue. Returns null if empty or paused. */
  popNext: (ruleId: string) => string | null
  /** Pause a queue */
  pause: (ruleId: string) => void
  /** Resume a queue */
  resume: (ruleId: string) => void
  /** Remove a queue */
  removeQueue: (ruleId: string) => void
  /** Get queue status */
  getQueue: (ruleId: string) => CommandQueue | undefined
  /** Check if all commands are done */
  isDone: (ruleId: string) => boolean
}

export const useCommandQueueStore = create<CommandQueueState>((set, get) => ({
  queues: [],

  setQueue: (ruleId, commands) => {
    set((state) => ({
      queues: [
        ...state.queues.filter((q) => q.ruleId !== ruleId),
        { ruleId, commands, currentIndex: 0, paused: false },
      ],
    }))
    // Persist
    persistQueues(get().queues)
  },

  popNext: (ruleId) => {
    const queue = get().queues.find((q) => q.ruleId === ruleId)
    if (!queue || queue.paused || queue.currentIndex >= queue.commands.length) {
      return null
    }

    const command = queue.commands[queue.currentIndex]
    set((state) => ({
      queues: state.queues.map((q) =>
        q.ruleId === ruleId ? { ...q, currentIndex: q.currentIndex + 1 } : q
      ),
    }))
    persistQueues(get().queues)
    return command
  },

  pause: (ruleId) => {
    set((state) => ({
      queues: state.queues.map((q) =>
        q.ruleId === ruleId ? { ...q, paused: true } : q
      ),
    }))
    persistQueues(get().queues)
  },

  resume: (ruleId) => {
    set((state) => ({
      queues: state.queues.map((q) =>
        q.ruleId === ruleId ? { ...q, paused: false } : q
      ),
    }))
    persistQueues(get().queues)
  },

  removeQueue: (ruleId) => {
    set((state) => ({
      queues: state.queues.filter((q) => q.ruleId !== ruleId),
    }))
    persistQueues(get().queues)
  },

  getQueue: (ruleId) => {
    return get().queues.find((q) => q.ruleId === ruleId)
  },

  isDone: (ruleId) => {
    const queue = get().queues.find((q) => q.ruleId === ruleId)
    if (!queue) return true
    return queue.currentIndex >= queue.commands.length
  },
}))

function persistQueues(queues: CommandQueue[]) {
  window.electronAPI?.storeSet('commandQueues', queues)
}

/** Initialize from persistent storage */
export async function initCommandQueues(): Promise<void> {
  try {
    const saved = await window.electronAPI?.storeGet('commandQueues')
    if (Array.isArray(saved)) {
      useCommandQueueStore.setState({ queues: saved as CommandQueue[] })
    }
  } catch {
    // Ignore
  }
}
