import { describe, it, expect, beforeEach } from 'vitest'
import { useAdminStore } from '@/stores/adminStore'
import { useFeedbackStore } from '@/stores/feedbackStore'
import {
  createClaudeCodePreset,
  createWebWatchPreset,
  createBuildWatchPreset,
  removePreset,
  isPresetActive,
} from '../watch-presets'

describe('watch-presets', () => {
  beforeEach(() => {
    // Reset stores
    useAdminStore.setState({
      monitorRules: [],
      autoReplyRules: [],
      auditLog: [],
      delegationLog: [],
    })
    useFeedbackStore.setState({ toasts: [], statusPills: [] })
  })

  describe('createClaudeCodePreset', () => {
    it('creates 3 monitor rules with claude_code presetId', () => {
      createClaudeCodePreset()
      const rules = useAdminStore.getState().monitorRules
      expect(rules.filter((r) => r.presetId === 'claude_code')).toHaveLength(3)
    })

    it('creates rules for completion, error, and permission detection', () => {
      createClaudeCodePreset()
      const rules = useAdminStore.getState().monitorRules
      const names = rules.map((r) => r.name)
      expect(names.some((n) => n.includes('完成'))).toBe(true)
      expect(names.some((n) => n.includes('错误'))).toBe(true)
      expect(names.some((n) => n.includes('权限'))).toBe(true)
    })

    it('adds a status pill', () => {
      createClaudeCodePreset()
      expect(useFeedbackStore.getState().statusPills).toHaveLength(1)
      expect(useFeedbackStore.getState().statusPills[0].scenarioId).toBe('claude_code')
    })

    it('adds a toast', () => {
      createClaudeCodePreset()
      expect(useFeedbackStore.getState().toasts.length).toBeGreaterThan(0)
    })
  })

  describe('createWebWatchPreset', () => {
    it('creates 1 content_change rule', () => {
      createWebWatchPreset()
      const rules = useAdminStore.getState().monitorRules
      expect(rules.filter((r) => r.presetId === 'web_watch')).toHaveLength(1)
      expect(rules[0].trigger.type).toBe('content_change')
    })
  })

  describe('createBuildWatchPreset', () => {
    it('creates rule with conditions containing completion keywords', () => {
      createBuildWatchPreset()
      const rules = useAdminStore.getState().monitorRules
      expect(rules).toHaveLength(1)
      expect(rules[0].conditions?.contains).toContain('100%')
      expect(rules[0].conditions?.contains).toContain('success')
    })
  })

  describe('removePreset', () => {
    it('removes all rules with given presetId', () => {
      createClaudeCodePreset()
      createWebWatchPreset()
      expect(useAdminStore.getState().monitorRules.length).toBe(4)
      removePreset('claude_code')
      const remaining = useAdminStore.getState().monitorRules
      expect(remaining.length).toBe(1)
      expect(remaining[0].presetId).toBe('web_watch')
    })

    it('removes associated status pills', () => {
      createClaudeCodePreset()
      expect(useFeedbackStore.getState().statusPills).toHaveLength(1)
      removePreset('claude_code')
      expect(useFeedbackStore.getState().statusPills).toHaveLength(0)
    })
  })

  describe('isPresetActive', () => {
    it('returns true when preset rules exist and are enabled', () => {
      createClaudeCodePreset()
      expect(isPresetActive('claude_code')).toBe(true)
    })

    it('returns false when no preset rules exist', () => {
      expect(isPresetActive('claude_code')).toBe(false)
    })
  })
})
