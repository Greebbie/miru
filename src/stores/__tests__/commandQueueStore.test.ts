import { describe, it, expect, beforeEach } from 'vitest'
import { useCommandQueueStore } from '../commandQueueStore'

describe('commandQueueStore', () => {
  beforeEach(() => {
    useCommandQueueStore.setState({ queues: [] })
  })

  it('setQueue creates a new queue', () => {
    useCommandQueueStore.getState().setQueue('rule1', ['cmd1', 'cmd2', 'cmd3'])
    const queue = useCommandQueueStore.getState().getQueue('rule1')
    expect(queue).toBeTruthy()
    expect(queue!.commands).toEqual(['cmd1', 'cmd2', 'cmd3'])
    expect(queue!.currentIndex).toBe(0)
    expect(queue!.paused).toBe(false)
  })

  it('popNext returns commands in order', () => {
    const store = useCommandQueueStore.getState()
    store.setQueue('rule1', ['a', 'b', 'c'])
    expect(store.popNext('rule1')).toBe('a')
    expect(store.popNext('rule1')).toBe('b')
    expect(store.popNext('rule1')).toBe('c')
    expect(store.popNext('rule1')).toBeNull()
  })

  it('popNext returns null when paused', () => {
    const store = useCommandQueueStore.getState()
    store.setQueue('rule1', ['a', 'b'])
    store.pause('rule1')
    expect(store.popNext('rule1')).toBeNull()
  })

  it('resume allows popNext after pause', () => {
    const store = useCommandQueueStore.getState()
    store.setQueue('rule1', ['a', 'b'])
    store.pause('rule1')
    store.resume('rule1')
    expect(store.popNext('rule1')).toBe('a')
  })

  it('isDone returns true when all commands consumed', () => {
    const store = useCommandQueueStore.getState()
    store.setQueue('rule1', ['a'])
    expect(store.isDone('rule1')).toBe(false)
    store.popNext('rule1')
    expect(store.isDone('rule1')).toBe(true)
  })

  it('isDone returns true for non-existent queue', () => {
    expect(useCommandQueueStore.getState().isDone('nope')).toBe(true)
  })

  it('removeQueue removes the queue', () => {
    const store = useCommandQueueStore.getState()
    store.setQueue('rule1', ['a'])
    store.removeQueue('rule1')
    expect(store.getQueue('rule1')).toBeUndefined()
  })

  it('setQueue replaces existing queue', () => {
    const store = useCommandQueueStore.getState()
    store.setQueue('rule1', ['a', 'b'])
    store.popNext('rule1') // consume 'a'
    store.setQueue('rule1', ['x', 'y']) // replace
    expect(store.popNext('rule1')).toBe('x')
  })

  it('persists to electronAPI.storeSet', () => {
    useCommandQueueStore.getState().setQueue('rule1', ['a'])
    expect(window.electronAPI.storeSet).toHaveBeenCalledWith(
      'commandQueues',
      expect.any(Array)
    )
  })
})
