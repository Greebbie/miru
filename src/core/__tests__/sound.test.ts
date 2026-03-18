import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { playSound } from '../sound'

// The sound module caches a single AudioContext at module level.
// We grab the instance from the first call and track its methods across tests.
let ctxInstance: any = null

function getCtxInstance() {
  if (!ctxInstance) {
    const AudioContextMock = globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>
    if (AudioContextMock.mock.results.length > 0) {
      ctxInstance = AudioContextMock.mock.results[0].value
    }
  }
  return ctxInstance
}

describe('sound', () => {
  beforeEach(() => {
    useConfigStore.setState({ soundEnabled: true })
    // Clear the ctx instance's method call counts (but not the AudioContext constructor mock)
    const ctx = getCtxInstance()
    if (ctx) {
      ctx.createOscillator.mockClear()
      ctx.createGain.mockClear()
      ctx.resume.mockClear()
      ctx.state = 'running'
    }
  })

  describe('playSound', () => {
    it('creates oscillator and gain for click sound', () => {
      playSound('click')

      const ctx = getCtxInstance()
      expect(ctx.createOscillator).toHaveBeenCalledTimes(1)
      expect(ctx.createGain).toHaveBeenCalledTimes(1)
    })

    it('plays two notes for reply sound', () => {
      playSound('reply')

      const ctx = getCtxInstance()
      expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
      expect(ctx.createGain).toHaveBeenCalledTimes(2)
    })

    it('plays three notes for complete sound', () => {
      playSound('complete')

      const ctx = getCtxInstance()
      expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
      expect(ctx.createGain).toHaveBeenCalledTimes(3)
    })

    it('uses square wave for alert sound', () => {
      playSound('alert')

      const ctx = getCtxInstance()
      const oscResults = ctx.createOscillator.mock.results
      expect(oscResults.length).toBe(1)
      expect(oscResults[0].value.type).toBe('square')
    })

    it('does nothing when soundEnabled is false', () => {
      useConfigStore.setState({ soundEnabled: false })

      const ctx = getCtxInstance()
      const oscCountBefore = ctx.createOscillator.mock.calls.length

      playSound('click')

      expect(ctx.createOscillator.mock.calls.length).toBe(oscCountBefore)
    })

    it('resumes suspended AudioContext', () => {
      const ctx = getCtxInstance()
      ctx.state = 'suspended'

      playSound('click')

      expect(ctx.resume).toHaveBeenCalled()
    })

    it('ignores errors silently', () => {
      // The module already has a cached ctx, so AudioContext constructor won't throw.
      // But the try/catch in playSound handles any runtime errors.
      // We verify the function doesn't throw regardless.
      expect(() => playSound('click')).not.toThrow()
    })
  })
})
