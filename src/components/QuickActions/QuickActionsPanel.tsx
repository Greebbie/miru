import { useCallback } from 'react'
import { motion } from 'framer-motion'
import ScenarioCard from './ScenarioCard'
import { useAdminStore } from '@/stores/adminStore'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { createClaudeCodePreset, createWebWatchPreset, createBuildWatchPreset, removePreset, isPresetActive } from '@/core/skills/watch-presets'
import { useI18n } from '@/i18n/useI18n'

interface QuickActionsPanelProps {
  onClose: () => void
  onOpenAdmin: () => void
}

export default function QuickActionsPanel({ onClose, onOpenAdmin }: QuickActionsPanelProps) {
  const { t } = useI18n()
  const monitorRules = useAdminStore((s) => s.monitorRules)
  const autoReplyRules = useAdminStore((s) => s.autoReplyRules)

  // Check if WeChat monitoring is active
  const isWeChatActive = autoReplyRules.some(
    (r) => r.app === 'wechat' && r.enabled
  )

  // Check if any window watch monitor rule is active
  const isWatchActive = monitorRules.some((r) => r.enabled)

  const toggleWeChat = useCallback(() => {
    const store = useAdminStore.getState()
    const wechatRules = store.autoReplyRules.filter((r) => r.app === 'wechat')

    if (wechatRules.length > 0) {
      // Toggle existing rules
      for (const rule of wechatRules) {
        store.updateAutoReplyRule(rule.id, { enabled: !rule.enabled })
      }
      const newState = !wechatRules[0].enabled
      const feedback = useFeedbackStore.getState()
      if (newState) {
        feedback.addToast({ icon: '\uD83D\uDCAC', message: '微信监控已启动', type: 'success' })
        feedback.addStatusPill({
          label: '微信监控',
          icon: '\uD83D\uDCAC',
          targetPanel: 'quickActions',
          scenarioId: 'wechat',
        })
      } else {
        feedback.addToast({ icon: '\uD83D\uDCAC', message: '微信监控已停止', type: 'info' })
        feedback.removeStatusPillByScenario('wechat')
      }
    } else {
      // Create a default WeChat auto-reply rule
      store.addAutoReplyRule({
        name: '微信托管',
        enabled: true,
        app: 'wechat',
        triggerKeywords: ['新消息', '发来', '说', ':', '：'],
        replyTemplate: '我现在不在，稍后回复你',
        useAI: true,
        idleMinutes: 5,
        requireConfirm: true,
        sensitiveKeywords: ['钱', '银行', '密码', '账号', '转账'],
        maxRepliesPerContact: 3,
      })
      const feedback = useFeedbackStore.getState()
      feedback.addToast({ icon: '\uD83D\uDCAC', message: '微信监控已启动', type: 'success' })
      feedback.addStatusPill({
        label: '微信监控',
        icon: '\uD83D\uDCAC',
        targetPanel: 'quickActions',
        scenarioId: 'wechat',
      })
    }
  }, [])

  // Check if specific presets are active
  const isClaudeCodeActive = isPresetActive('claude_code')
  const isWebWatchActive = isPresetActive('web_watch')
  const isBuildWatchActive = isPresetActive('build_watch')

  const toggleWatch = useCallback(() => {
    // Open admin panel to monitor tab for detailed config
    onOpenAdmin()
    onClose()
  }, [onOpenAdmin, onClose])

  const togglePreset = useCallback((presetId: string) => {
    if (isPresetActive(presetId)) {
      removePreset(presetId)
    } else {
      switch (presetId) {
        case 'claude_code': createClaudeCodePreset(); break
        case 'web_watch': createWebWatchPreset(); break
        case 'build_watch': createBuildWatchPreset(); break
      }
    }
  }, [])

  const openSkills = useCallback(() => {
    onOpenAdmin()
    onClose()
  }, [onOpenAdmin, onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-45 flex items-center justify-center p-4"
    >
      <div
        className="w-full max-w-[340px] max-h-[500px] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(20, 20, 30, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <h2 className="text-sm font-medium text-white/90">{t('qa.title')}</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Scenario cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* WeChat monitoring */}
          <ScenarioCard
            icon={'\uD83D\uDCAC'}
            title={t('qa.watchWeChat')}
            description={t('qa.watchWeChatDesc')}
            isActive={isWeChatActive}
            onToggle={toggleWeChat}
          >
            <div className="text-[10px] text-white/50 space-y-1">
              <p>{isWeChatActive ? t('qa.active') : t('qa.inactive')}</p>
              {isWeChatActive && (
                <p className="text-green-400/70">
                  {autoReplyRules.filter((r) => r.app === 'wechat' && r.enabled).length} rules active
                </p>
              )}
            </div>
          </ScenarioCard>

          {/* Window watch */}
          <ScenarioCard
            icon={'\uD83D\uDC41\uFE0F'}
            title={t('qa.watchWindow')}
            description={t('qa.watchWindowDesc')}
            isActive={isWatchActive}
            onToggle={toggleWatch}
          >
            <div className="space-y-1.5">
              {[
                { id: 'claude_code', label: t('qa.presetClaudeCode'), active: isClaudeCodeActive },
                { id: 'web_watch', label: t('qa.presetWebWatch'), active: isWebWatchActive },
                { id: 'build_watch', label: t('qa.presetBuildWatch'), active: isBuildWatchActive },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => togglePreset(preset.id)}
                  className={`w-full text-left text-[10px] px-2 py-1 rounded-md transition-colors ${
                    preset.active
                      ? 'bg-green-400/15 text-green-300/80'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  {preset.active ? '\u25CF ' : '\u25CB '}{preset.label}
                </button>
              ))}
              <button
                onClick={toggleWatch}
                className="w-full text-left text-[10px] px-2 py-1 rounded-md text-white/50 hover:bg-white/5 hover:text-white/70"
              >
                {'\u2699\uFE0F'} {t('qa.presetCustom')}
              </button>
            </div>
          </ScenarioCard>

          {/* Skills management */}
          <ScenarioCard
            icon={'\uD83E\uDDE9'}
            title={t('qa.manageSkills')}
            description={t('qa.manageSkillsDesc')}
            isActive={false}
            onToggle={openSkills}
          />

          {/* Quick commands — informational, always "active" */}
          <ScenarioCard
            icon={'\u26A1'}
            title={t('qa.quickCommand')}
            description={t('qa.quickCommandDesc')}
            isActive={true}
            onToggle={() => { onClose() }}
          >
            <div className="text-[10px] text-white/50">
              <p>{"\"打开 Chrome\" · \"去 GitHub\" · \"现在几点\""}</p>
            </div>
          </ScenarioCard>
        </div>
      </div>
    </motion.div>
  )
}
