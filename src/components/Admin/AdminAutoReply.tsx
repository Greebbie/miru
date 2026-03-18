import { useState } from 'react'
import { useAdminStore, type AutoReplyRule } from '@/stores/adminStore'
import { useI18n } from '@/i18n/useI18n'

type AppType = AutoReplyRule['app']

const APP_OPTIONS: { id: AppType; label: string }[] = [
  { id: 'wechat', label: 'WeChat' },
  { id: 'discord', label: 'Discord' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'other', label: 'Other' },
]

const APP_LABELS: Record<AppType, string> = {
  wechat: 'WeChat',
  discord: 'Discord',
  telegram: 'Telegram',
  outlook: 'Outlook',
  other: 'Other',
}

interface FormState {
  name: string
  app: AppType
  contactPattern: string
  triggerKeywords: string
  useAI: boolean
  replyTemplate: string
  idleMinutes: number
  requireConfirm: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  app: 'wechat',
  contactPattern: '',
  triggerKeywords: '',
  useAI: true,
  replyTemplate: '',
  idleMinutes: 5,
  requireConfirm: true,
}

export default function AdminAutoReply() {
  const autoReplyRules = useAdminStore((s) => s.autoReplyRules)
  const addAutoReplyRule = useAdminStore((s) => s.addAutoReplyRule)
  const updateAutoReplyRule = useAdminStore((s) => s.updateAutoReplyRule)
  const deleteAutoReplyRule = useAdminStore((s) => s.deleteAutoReplyRule)
  const { t } = useI18n()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  function handleSubmit() {
    if (!form.name) return
    addAutoReplyRule({
      name: form.name,
      enabled: true,
      app: form.app,
      contactPattern: form.contactPattern || undefined,
      triggerKeywords: form.triggerKeywords
        ? form.triggerKeywords.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      useAI: form.useAI,
      replyTemplate: form.useAI ? undefined : form.replyTemplate || undefined,
      idleMinutes: form.idleMinutes || undefined,
      requireConfirm: form.requireConfirm,
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {/* Rules list */}
      <div className="space-y-1">
        {autoReplyRules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors"
          >
            {/* App badge */}
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0 w-16 text-center">
              {APP_LABELS[rule.app]}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs font-medium truncate">{rule.name}</span>
                {rule.useAI ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0">AI</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">Template</span>
                )}
              </div>
              <div className="text-white/30 text-xs mt-0.5 truncate">
                {rule.contactPattern && `Contact: ${rule.contactPattern} | `}
                {rule.idleMinutes && `Idle: ${rule.idleMinutes}min | `}
                {rule.requireConfirm ? 'Confirm' : 'Auto'}
              </div>
            </div>

            {/* Confirm toggle */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-white/20 text-xs">Cfm</span>
              <button
                onClick={() => updateAutoReplyRule(rule.id, { requireConfirm: !rule.requireConfirm })}
                className={`w-7 h-3.5 rounded-full transition-colors relative ${
                  rule.requireConfirm ? 'bg-yellow-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    rule.requireConfirm ? 'left-3.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Enabled toggle */}
            <button
              onClick={() => updateAutoReplyRule(rule.id, { enabled: !rule.enabled })}
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
              onClick={() => deleteAutoReplyRule(rule.id)}
              className="text-white/20 hover:text-red-400 text-xs transition-colors shrink-0"
            >
              Del
            </button>
          </div>
        ))}

        {autoReplyRules.length === 0 && !showForm && (
          <p className="text-white/30 text-xs text-center py-6">{t('admin.ar.noRules')}</p>
        )}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.ar.ruleName')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Auto reply rule..."
                className="ar-input"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.ar.app')}</label>
              <select
                value={form.app}
                onChange={(e) => setForm({ ...form, app: e.target.value as AppType })}
                className="ar-input"
              >
                {APP_OPTIONS.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.ar.contactPattern')}</label>
              <input
                value={form.contactPattern}
                onChange={(e) => setForm({ ...form, contactPattern: e.target.value })}
                placeholder="regex or name..."
                className="ar-input"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.ar.triggerKeywords')}</label>
              <input
                value={form.triggerKeywords}
                onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })}
                placeholder="urgent, help, ..."
                className="ar-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useAI}
                onChange={(e) => setForm({ ...form, useAI: e.target.checked })}
                className="accent-blue-400"
              />
              <span className="text-white/60 text-xs">{t('admin.ar.useAI')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requireConfirm}
                onChange={(e) => setForm({ ...form, requireConfirm: e.target.checked })}
                className="accent-yellow-400"
              />
              <span className="text-white/60 text-xs">{t('admin.ar.requireConfirm')}</span>
            </label>
          </div>

          {!form.useAI && (
            <div>
              <label className="text-white/40 text-xs block mb-1">{t('admin.ar.replyTemplate')}</label>
              <textarea
                rows={2}
                value={form.replyTemplate}
                onChange={(e) => setForm({ ...form, replyTemplate: e.target.value })}
                placeholder="I'm currently away..."
                className="ar-input resize-none"
              />
            </div>
          )}

          <div>
            <label className="text-white/40 text-xs block mb-1">{t('admin.ar.idleMinutes')}</label>
            <input
              type="number"
              min={0}
              value={form.idleMinutes}
              onChange={(e) => setForm({ ...form, idleMinutes: parseInt(e.target.value) || 0 })}
              className="ar-input w-32"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              {t('admin.ar.addRule')}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
            >
              {t('admin.ar.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors border border-dashed border-white/10"
        >
          {t('admin.ar.add')}
        </button>
      )}

      <style>{`
        .ar-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          font-size: 0.75rem;
          border-radius: 0.375rem;
          padding: 0.375rem 0.5rem;
          border: 1px solid rgba(255,255,255,0.08);
          outline: none;
        }
        .ar-input:focus {
          border-color: rgba(96,165,250,0.5);
        }
        .ar-input option {
          background: #1e1e28;
          color: rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  )
}
