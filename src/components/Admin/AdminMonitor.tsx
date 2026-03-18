import { useState, useEffect, useCallback } from 'react'
import { useAdminStore, type MonitorRule } from '@/stores/adminStore'
import { useI18n } from '@/i18n/useI18n'

type TriggerType = MonitorRule['trigger']['type']
type ActionType = MonitorRule['action']['type']

interface FormState {
  name: string
  triggerType: TriggerType
  pattern: string
  app: string
  actionType: ActionType
  payload: string
  cooldownMs: number
  visionIntervalMs: number
  targetWindow: string
}

const EMPTY_FORM: FormState = {
  name: '',
  triggerType: 'app_focus',
  pattern: '',
  app: '',
  actionType: 'notify',
  payload: '',
  cooldownMs: 60000,
  visionIntervalMs: 10000,
  targetWindow: '',
}

export default function AdminMonitor() {
  const monitorRules = useAdminStore((s) => s.monitorRules)
  const addMonitorRule = useAdminStore((s) => s.addMonitorRule)
  const updateMonitorRule = useAdminStore((s) => s.updateMonitorRule)
  const deleteMonitorRule = useAdminStore((s) => s.deleteMonitorRule)
  const { t } = useI18n()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [windowList, setWindowList] = useState<{ id: string; name: string }[]>([])
  const [loadingWindows, setLoadingWindows] = useState(false)

  const TRIGGER_TYPES: { id: TriggerType; label: string }[] = [
    { id: 'app_focus', label: 'App Focus' },
    { id: 'window_title', label: 'Window Title' },
    { id: 'content_change', label: t('admin.monitor.triggerContentChange') },
  ]

  const ACTION_TYPES: { id: ActionType; label: string }[] = [
    { id: 'notify', label: 'Notify' },
    { id: 'auto_reply', label: 'Auto Reply' },
    { id: 'run_tool', label: 'Run Tool' },
    { id: 'run_skill', label: 'Run Skill' },
    { id: 'send_keys_to_app', label: t('admin.monitor.actionSendKeys') },
  ]

  const PRESETS: { label: string; form: FormState }[] = [
    {
      label: t('admin.monitor.watchWeChat'),
      form: {
        name: t('admin.monitor.watchWeChat'),
        triggerType: 'window_title',
        pattern: '微信',
        app: 'WeChat',
        actionType: 'notify',
        payload: '收到微信消息',
        cooldownMs: 30000,
        visionIntervalMs: 10000,
        targetWindow: '',
      },
    },
    {
      label: t('admin.monitor.watchDiscord'),
      form: {
        name: t('admin.monitor.watchDiscord'),
        triggerType: 'app_focus',
        pattern: 'Discord',
        app: 'Discord',
        actionType: 'notify',
        payload: 'Discord activity detected',
        cooldownMs: 60000,
        visionIntervalMs: 10000,
        targetWindow: '',
      },
    },
    {
      label: t('admin.monitor.presetWeChatVision'),
      form: {
        name: '微信消息监控',
        triggerType: 'content_change',
        pattern: '.*',
        app: '',
        actionType: 'notify',
        payload: '检测到微信新消息',
        cooldownMs: 30000,
        visionIntervalMs: 10000,
        targetWindow: '微信',
      },
    },
    {
      label: t('admin.monitor.presetCLIBabysit'),
      form: {
        name: 'CLI 值守',
        triggerType: 'content_change',
        pattern: '(completed|finished|done|idle|Plan|plan mode)',
        app: '',
        actionType: 'send_keys_to_app',
        payload: '/implement{ENTER}',
        cooldownMs: 120000,
        visionIntervalMs: 15000,
        targetWindow: 'Terminal',
      },
    },
  ]

  const refreshWindows = useCallback(async () => {
    if (!window.electronAPI?.getWindowList) return
    setLoadingWindows(true)
    try {
      const list = await window.electronAPI.getWindowList()
      setWindowList(list)
    } catch {
      setWindowList([])
    } finally {
      setLoadingWindows(false)
    }
  }, [])

  // Auto-fetch window list when switching to content_change
  useEffect(() => {
    if (form.triggerType === 'content_change' && windowList.length === 0) {
      refreshWindows()
    }
  }, [form.triggerType, windowList.length, refreshWindows])

  function handleSubmit() {
    if (!form.name || !form.pattern) return

    const triggerApp = form.triggerType === 'content_change'
      ? form.targetWindow
      : form.app

    addMonitorRule({
      name: form.name,
      enabled: true,
      trigger: {
        type: form.triggerType,
        pattern: form.pattern,
        app: triggerApp || undefined,
        ...(form.triggerType === 'content_change' ? { visionIntervalMs: form.visionIntervalMs } : {}),
      },
      action: {
        type: form.actionType,
        payload: form.payload,
      },
      cooldownMs: form.cooldownMs,
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function applyPreset(preset: FormState) {
    setForm(preset)
    setShowForm(true)
  }

  const isContentChange = form.triggerType === 'content_change'
  const isSendKeys = form.actionType === 'send_keys_to_app'

  return (
    <div className="space-y-3">
      {/* Preset quick-add */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.form)}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors border border-white/5"
          >
            + {p.label}
          </button>
        ))}
      </div>

      {/* Rules list */}
      <div className="space-y-1">
        {monitorRules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs font-medium truncate">{rule.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
                  {rule.trigger.type}
                </span>
                {rule.trigger.type === 'content_change' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">
                    Vision
                  </span>
                )}
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0">
                  {rule.action.type}
                </span>
              </div>
              <div className="text-white/30 text-xs mt-0.5 truncate">
                {rule.trigger.type === 'content_change' && rule.trigger.app && (
                  <span className="text-cyan-400/60">[{rule.trigger.app}] </span>
                )}
                Pattern: {rule.trigger.pattern} | Payload: {rule.action.payload}
                {rule.trigger.visionIntervalMs && (
                  <span className="text-white/20"> | {rule.trigger.visionIntervalMs / 1000}s</span>
                )}
              </div>
            </div>

            {/* Enabled toggle */}
            <button
              onClick={() => updateMonitorRule(rule.id, { enabled: !rule.enabled })}
              className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
                rule.enabled ? 'bg-blue-500' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                  rule.enabled ? 'left-4' : 'left-0.5'
                }`}
              />
            </button>

            {/* Delete */}
            <button
              onClick={() => deleteMonitorRule(rule.id)}
              className="text-white/20 hover:text-red-400 text-xs transition-colors shrink-0"
            >
              Del
            </button>
          </div>
        ))}

        {monitorRules.length === 0 && !showForm && (
          <p className="text-white/30 text-xs text-center py-6">{t('admin.monitor.noRules')}</p>
        )}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.ruleName')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My rule..."
                className="admin-input"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.triggerType')}</label>
              <select
                value={form.triggerType}
                onChange={(e) => setForm({ ...form, triggerType: e.target.value as TriggerType })}
                className="admin-input"
              >
                {TRIGGER_TYPES.map((tt) => (
                  <option key={tt.id} value={tt.id}>{tt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Window selector for content_change */}
          {isContentChange ? (
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.targetWindow')}</label>
              <div className="flex gap-2">
                <select
                  value={form.targetWindow}
                  onChange={(e) => setForm({ ...form, targetWindow: e.target.value })}
                  className="admin-input flex-1"
                >
                  <option value="">{t('admin.monitor.noWindows')}</option>
                  {windowList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
                <button
                  onClick={refreshWindows}
                  disabled={loadingWindows}
                  className="px-2 py-1 rounded text-xs bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/70 transition-colors shrink-0"
                >
                  {loadingWindows ? '...' : t('admin.monitor.refreshWindows')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.app')}</label>
              <input
                value={form.app}
                onChange={(e) => setForm({ ...form, app: e.target.value })}
                placeholder="WeChat, Discord..."
                className="admin-input"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.pattern')}</label>
              <input
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                placeholder={isContentChange ? '.*  or  keyword|regex' : 'regex or keyword...'}
                className="admin-input"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.actionType')}</label>
              <select
                value={form.actionType}
                onChange={(e) => setForm({ ...form, actionType: e.target.value as ActionType })}
                className="admin-input"
              >
                {ACTION_TYPES.map((at) => (
                  <option key={at.id} value={at.id}>{at.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.payload')}</label>
              <input
                value={form.payload}
                onChange={(e) => setForm({ ...form, payload: e.target.value })}
                placeholder={isSendKeys ? t('admin.monitor.payloadHintKeys') : 'Message or tool name...'}
                className="admin-input"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.cooldown')}</label>
              <input
                type="number"
                value={form.cooldownMs}
                onChange={(e) => setForm({ ...form, cooldownMs: parseInt(e.target.value) || 0 })}
                className="admin-input"
              />
            </div>
          </div>

          {/* Vision interval for content_change */}
          {isContentChange && (
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.monitor.visionInterval')}</label>
              <input
                type="number"
                value={form.visionIntervalMs}
                onChange={(e) => setForm({ ...form, visionIntervalMs: parseInt(e.target.value) || 10000 })}
                className="admin-input w-40"
                min={5000}
                step={1000}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              {t('admin.monitor.addRule')}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
            >
              {t('admin.monitor.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors border border-dashed border-white/10"
        >
          {t('admin.monitor.add')}
        </button>
      )}

      <style>{`
        .admin-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          font-size: 0.75rem;
          border-radius: 0.375rem;
          padding: 0.375rem 0.5rem;
          border: 1px solid rgba(255,255,255,0.08);
          outline: none;
        }
        .admin-input:focus {
          border-color: rgba(96,165,250,0.5);
        }
        .admin-input option {
          background: #1e1e28;
          color: rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  )
}
