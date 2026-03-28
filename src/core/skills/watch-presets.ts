/**
 * Watch Presets — predefined monitor rule configurations for common scenarios.
 * These are "quick configurations", not hardcoded behaviors. Users can modify
 * the generated rules after creation.
 */

import { useAdminStore } from '@/stores/adminStore'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { PRESET_INTERVALS } from '@/core/constants'

interface PresetResult {
  ruleIds: string[]
}

/**
 * Create a "Watch Claude Code" preset:
 * Monitors a terminal window for completion, errors, or permission prompts.
 */
export function createClaudeCodePreset(targetApp?: string): PresetResult {
  const store = useAdminStore.getState()
  const app = targetApp || 'terminal'
  const ruleIds: string[] = []

  // Rule 1: Detect completion
  store.addMonitorRule({
    name: 'Claude Code — 完成检测',
    enabled: true,
    trigger: {
      type: 'content_change',
      pattern: '.*',
      app,
      visionIntervalMs: PRESET_INTERVALS.claudeCode,
    },
    conditions: {
      contains: ['completed', 'Plan mode', 'finished', 'done', 'Idle'],
    },
    action: {
      type: 'notify',
      payload: 'Claude Code 任务已完成: {title}',
    },
    cooldownMs: 30000,
    presetId: 'claude_code',
  })

  // Rule 2: Detect errors
  store.addMonitorRule({
    name: 'Claude Code — 错误检测',
    enabled: true,
    trigger: {
      type: 'content_change',
      pattern: '.*',
      app,
      visionIntervalMs: PRESET_INTERVALS.claudeCode,
    },
    conditions: {
      contains: ['Error', 'FAILED', 'error:', 'panic'],
      stateChange: 'error_detected',
    },
    action: {
      type: 'notify',
      payload: 'Claude Code 检测到错误: {title}',
    },
    cooldownMs: 15000,
    presetId: 'claude_code',
  })

  // Rule 3: Detect permission prompts
  store.addMonitorRule({
    name: 'Claude Code — 权限提示',
    enabled: true,
    trigger: {
      type: 'content_change',
      pattern: '.*',
      app,
      visionIntervalMs: PRESET_INTERVALS.claudeCode,
    },
    conditions: {
      contains: ['Allow', 'Deny', 'y/n', 'approve'],
    },
    action: {
      type: 'notify',
      payload: 'Claude Code 需要你的确认: {title}',
    },
    cooldownMs: 10000,
    presetId: 'claude_code',
  })

  const feedback = useFeedbackStore.getState()
  feedback.addToast({ icon: '\uD83D\uDCBB', message: 'Claude Code 看守已启动', type: 'success' })
  feedback.addStatusPill({
    label: 'Claude Code',
    icon: '\uD83D\uDCBB',
    targetPanel: 'quickActions',
    scenarioId: 'claude_code',
  })

  return { ruleIds }
}

/**
 * Create a "Watch Web Page" preset:
 * Monitors a browser window for content changes.
 */
export function createWebWatchPreset(targetApp?: string): PresetResult {
  const store = useAdminStore.getState()
  const app = targetApp || 'chrome'

  store.addMonitorRule({
    name: '网页变化监控',
    enabled: true,
    trigger: {
      type: 'content_change',
      pattern: '.*',
      app,
      visionIntervalMs: PRESET_INTERVALS.webWatch,
    },
    action: {
      type: 'notify',
      payload: '检测到 {app} 页面内容变化',
    },
    cooldownMs: 60000,
    presetId: 'web_watch',
  })

  const feedback = useFeedbackStore.getState()
  feedback.addToast({ icon: '\uD83C\uDF10', message: '网页监控已启动', type: 'success' })
  feedback.addStatusPill({
    label: '网页监控',
    icon: '\uD83C\uDF10',
    targetPanel: 'quickActions',
    scenarioId: 'web_watch',
  })

  return { ruleIds: [] }
}

/**
 * Create a "Watch Build/Download" preset:
 * Monitors for completion or progress in a window.
 */
export function createBuildWatchPreset(targetApp?: string): PresetResult {
  const store = useAdminStore.getState()
  const app = targetApp || ''

  store.addMonitorRule({
    name: '编译/下载完成检测',
    enabled: true,
    trigger: {
      type: 'content_change',
      pattern: '.*',
      app,
      visionIntervalMs: PRESET_INTERVALS.buildWatch,
    },
    conditions: {
      contains: ['100%', 'complete', 'success', 'BUILD SUCCESS', 'finished', 'done'],
    },
    action: {
      type: 'notify',
      payload: '任务已完成: {title}',
    },
    cooldownMs: 30000,
    presetId: 'build_watch',
  })

  const feedback = useFeedbackStore.getState()
  feedback.addToast({ icon: '\uD83D\uDD28', message: '编译监控已启动', type: 'success' })
  feedback.addStatusPill({
    label: '编译监控',
    icon: '\uD83D\uDD28',
    targetPanel: 'quickActions',
    scenarioId: 'build_watch',
  })

  return { ruleIds: [] }
}

/** Remove all rules created by a specific preset */
export function removePreset(presetId: string): void {
  const store = useAdminStore.getState()
  const rules = store.monitorRules.filter((r) => r.presetId === presetId)
  for (const rule of rules) {
    store.deleteMonitorRule(rule.id)
  }
  useFeedbackStore.getState().removeStatusPillByScenario(presetId)
}

/** Check if a preset is currently active */
export function isPresetActive(presetId: string): boolean {
  const store = useAdminStore.getState()
  return store.monitorRules.some((r) => r.presetId === presetId && r.enabled)
}
