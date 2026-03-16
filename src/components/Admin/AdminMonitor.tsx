import { useState } from 'react'
import { useAdminStore, type MonitorRule } from '@/stores/adminStore'

type TriggerType = MonitorRule['trigger']['type']
type ActionType = MonitorRule['action']['type']

const TRIGGER_TYPES: { id: TriggerType; label: string }[] = [
  { id: 'app_focus', label: 'App Focus' },
  { id: 'window_title', label: 'Window Title' },
]

const ACTION_TYPES: { id: ActionType; label: string }[] = [
  { id: 'notify', label: 'Notify' },
  { id: 'auto_reply', label: 'Auto Reply' },
  { id: 'run_tool', label: 'Run Tool' },
  { id: 'run_skill', label: 'Run Skill' },
]

interface FormState {
  name: string
  triggerType: TriggerType
  pattern: string
  app: string
  actionType: ActionType
  payload: string
  cooldownMs: number
}

const EMPTY_FORM: FormState = {
  name: '',
  triggerType: 'app_focus',
  pattern: '',
  app: '',
  actionType: 'notify',
  payload: '',
  cooldownMs: 60000,
}

const PRESETS: { label: string; form: FormState }[] = [
  {
    label: '监控微信',
    form: {
      name: '微信消息监控',
      triggerType: 'window_title',
      pattern: '微信',
      app: 'WeChat',
      actionType: 'notify',
      payload: '收到微信消息',
      cooldownMs: 30000,
    },
  },
  {
    label: '监控 Discord',
    form: {
      name: 'Discord 消息监控',
      triggerType: 'app_focus',
      pattern: 'Discord',
      app: 'Discord',
      actionType: 'notify',
      payload: 'Discord activity detected',
      cooldownMs: 60000,
    },
  },
]

export default function AdminMonitor() {
  const monitorRules = useAdminStore((s) => s.monitorRules)
  const addMonitorRule = useAdminStore((s) => s.addMonitorRule)
  const updateMonitorRule = useAdminStore((s) => s.updateMonitorRule)
  const deleteMonitorRule = useAdminStore((s) => s.deleteMonitorRule)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  function handleSubmit() {
    if (!form.name || !form.pattern) return
    addMonitorRule({
      name: form.name,
      enabled: true,
      trigger: {
        type: form.triggerType,
        pattern: form.pattern,
        app: form.app || undefined,
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

  return (
    <div className="space-y-3">
      {/* Preset quick-add */}
      <div className="flex gap-2">
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
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0">
                  {rule.action.type}
                </span>
              </div>
              <div className="text-white/30 text-xs mt-0.5 truncate">
                Pattern: {rule.trigger.pattern} | Payload: {rule.action.payload}
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
          <p className="text-white/30 text-xs text-center py-6">No monitor rules yet</p>
        )}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">Rule Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My rule..."
                className="admin-input"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">App (optional)</label>
              <input
                value={form.app}
                onChange={(e) => setForm({ ...form, app: e.target.value })}
                placeholder="WeChat, Discord..."
                className="admin-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">Trigger Type</label>
              <select
                value={form.triggerType}
                onChange={(e) => setForm({ ...form, triggerType: e.target.value as TriggerType })}
                className="admin-input"
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">Pattern</label>
              <input
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                placeholder="regex or cron..."
                className="admin-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">Action Type</label>
              <select
                value={form.actionType}
                onChange={(e) => setForm({ ...form, actionType: e.target.value as ActionType })}
                className="admin-input"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">Payload</label>
              <input
                value={form.payload}
                onChange={(e) => setForm({ ...form, payload: e.target.value })}
                placeholder="Message or tool name..."
                className="admin-input"
              />
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs block mb-1">Cooldown (ms)</label>
            <input
              type="number"
              value={form.cooldownMs}
              onChange={(e) => setForm({ ...form, cooldownMs: parseInt(e.target.value) || 0 })}
              className="admin-input w-40"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Add Rule
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors border border-dashed border-white/10"
        >
          + Add Rule
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
