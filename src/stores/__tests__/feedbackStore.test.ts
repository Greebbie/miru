import { describe, it, expect, beforeEach } from 'vitest'
import { useFeedbackStore } from '../feedbackStore'

describe('feedbackStore', () => {
  beforeEach(() => {
    useFeedbackStore.setState({ toasts: [], statusPills: [] })
  })

  describe('toasts', () => {
    it('addToast adds a toast with generated id and timestamp', () => {
      useFeedbackStore.getState().addToast({
        icon: '\u2705',
        message: 'test',
        type: 'success',
      })
      const { toasts } = useFeedbackStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].icon).toBe('\u2705')
      expect(toasts[0].message).toBe('test')
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].id).toBeTruthy()
      expect(toasts[0].createdAt).toBeGreaterThan(0)
    })

    it('addToast keeps max 5 toasts', () => {
      const store = useFeedbackStore.getState()
      for (let i = 0; i < 8; i++) {
        store.addToast({ icon: '!', message: `msg${i}`, type: 'info' })
      }
      const { toasts } = useFeedbackStore.getState()
      expect(toasts.length).toBeLessThanOrEqual(5)
      expect(toasts[toasts.length - 1].message).toBe('msg7')
    })

    it('removeToast removes by id', () => {
      useFeedbackStore.getState().addToast({ icon: 'a', message: 'a', type: 'info' })
      useFeedbackStore.getState().addToast({ icon: 'b', message: 'b', type: 'info' })
      const id = useFeedbackStore.getState().toasts[0].id
      useFeedbackStore.getState().removeToast(id)
      expect(useFeedbackStore.getState().toasts).toHaveLength(1)
      expect(useFeedbackStore.getState().toasts[0].message).toBe('b')
    })

    it('clearToasts removes all', () => {
      useFeedbackStore.getState().addToast({ icon: 'a', message: 'a', type: 'info' })
      useFeedbackStore.getState().addToast({ icon: 'b', message: 'b', type: 'info' })
      useFeedbackStore.getState().clearToasts()
      expect(useFeedbackStore.getState().toasts).toHaveLength(0)
    })
  })

  describe('statusPills', () => {
    it('addStatusPill adds pill with generated id', () => {
      const pill = useFeedbackStore.getState().addStatusPill({
        label: 'Monitoring',
        icon: '\uD83D\uDC41',
        scenarioId: 'test',
      })
      expect(pill.id).toBeTruthy()
      expect(useFeedbackStore.getState().statusPills).toHaveLength(1)
      expect(useFeedbackStore.getState().statusPills[0].label).toBe('Monitoring')
    })

    it('removeStatusPill removes by id', () => {
      const pill = useFeedbackStore.getState().addStatusPill({
        label: 'A', icon: 'a',
      })
      useFeedbackStore.getState().addStatusPill({ label: 'B', icon: 'b' })
      useFeedbackStore.getState().removeStatusPill(pill.id)
      expect(useFeedbackStore.getState().statusPills).toHaveLength(1)
      expect(useFeedbackStore.getState().statusPills[0].label).toBe('B')
    })

    it('removeStatusPillByScenario removes all pills with scenarioId', () => {
      useFeedbackStore.getState().addStatusPill({ label: 'A', icon: 'a', scenarioId: 'wechat' })
      useFeedbackStore.getState().addStatusPill({ label: 'B', icon: 'b', scenarioId: 'wechat' })
      useFeedbackStore.getState().addStatusPill({ label: 'C', icon: 'c', scenarioId: 'other' })
      useFeedbackStore.getState().removeStatusPillByScenario('wechat')
      expect(useFeedbackStore.getState().statusPills).toHaveLength(1)
      expect(useFeedbackStore.getState().statusPills[0].label).toBe('C')
    })
  })

  describe('notifyNative', () => {
    it('calls electronAPI.nativeNotify', () => {
      useFeedbackStore.getState().notifyNative('Title', 'Body')
      expect(window.electronAPI.nativeNotify).toHaveBeenCalledWith('Title', 'Body')
    })
  })
})
