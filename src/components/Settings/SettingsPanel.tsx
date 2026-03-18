import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfigStore, type AIProviderType } from '@/stores/configStore'
import { testConnection } from '@/core/ai/testConnection'
import { humanizeError } from '@/core/errors/humanize'
import { useI18n } from '@/i18n/useI18n'
import MemoryViewer from './MemoryViewer'

type Tab = 'ai' | 'personality' | 'memory' | 'general'

interface ProviderOption {
  id: AIProviderType
  name: string
  needsKey: boolean
  needsBaseUrl: boolean
  needsGroupId: boolean
}

const PROVIDERS: ProviderOption[] = [
  { id: 'claude', name: 'Claude', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'openai', name: 'OpenAI', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'deepseek', name: 'DeepSeek', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'ollama', name: 'Ollama', needsKey: false, needsBaseUrl: true, needsGroupId: false },
  { id: 'vllm', name: 'vLLM', needsKey: false, needsBaseUrl: true, needsGroupId: false },
  { id: 'qwen', name: 'Qwen', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'minimax', name: 'Minimax', needsKey: true, needsBaseUrl: false, needsGroupId: true },
]

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('ai')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const config = useConfigStore()
  const currentProvider = PROVIDERS.find((p) => p.id === config.provider)
  const { t, lang } = useI18n()

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const error = await testConnection(config.provider, config.apiKey, config.baseUrl, config.groupId)
    if (error) {
      setTestResult({ ok: false, msg: humanizeError(error, lang) })
    } else {
      setTestResult({ ok: true, msg: t('settings.ai.testOk') })
    }
    setTesting(false)
  }

  const tabLabels: Record<Tab, string> = {
    ai: t('settings.tab.ai'),
    personality: t('settings.tab.personality'),
    memory: t('settings.tab.memory'),
    general: t('settings.tab.general'),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-[360px] max-h-[500px] rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(30, 30, 40, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <span className="text-white text-sm font-medium">{t('settings.title')}</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-lg">{'\u00D7'}</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['ai', 'personality', 'memory', 'general'] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === tabId ? 'text-white border-b-2 border-blue-400' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tabLabels[tabId]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence mode="wait">
          {tab === 'ai' && (
            <TabContent key="ai">
              <Label>{t('settings.ai.service')}</Label>
              <div className="space-y-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => config.setProvider(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      config.provider === p.id
                        ? 'bg-blue-500/30 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {currentProvider?.needsKey && (
                <>
                  <Label>{t('settings.ai.apiKey')}</Label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => config.setApiKey(e.target.value)}
                    className="input-field"
                    placeholder="sk-..."
                  />
                </>
              )}

              {currentProvider?.needsBaseUrl && (
                <>
                  <Label>{t('settings.ai.baseUrl')}</Label>
                  <input
                    value={config.baseUrl}
                    onChange={(e) => config.setBaseUrl(e.target.value)}
                    className="input-field"
                    placeholder="http://localhost:11434/v1"
                  />
                </>
              )}

              {currentProvider?.needsGroupId && (
                <>
                  <Label>{t('settings.ai.groupId')}</Label>
                  <input
                    value={config.groupId}
                    onChange={(e) => config.setGroupId(e.target.value)}
                    className="input-field"
                    placeholder="Group ID"
                  />
                </>
              )}

              <Label>{t('settings.ai.model')}</Label>
              <input
                value={config.model}
                onChange={(e) => config.setModel(e.target.value)}
                className="input-field"
                placeholder="claude-sonnet-4-20250514"
              />

              <Label>{t('settings.ai.tokenBudget')}</Label>
              <div className="flex gap-1">
                {(['minimal', 'balanced', 'smart'] as const).map((budget) => (
                  <button
                    key={budget}
                    onClick={() => config.setTokenBudget(budget)}
                    className={`flex-1 px-3 py-1 rounded-full text-xs transition-colors ${
                      config.tokenBudget === budget
                        ? 'bg-blue-500/30 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {t(`settings.ai.budget.${budget}`)}
                  </button>
                ))}
              </div>

              {/* Test Connection */}
              {testResult && (
                <p className={`text-xs mt-2 ${testResult.ok ? 'text-green-400/80' : 'text-yellow-400/80'}`}>
                  {testResult.ok ? '\u2705 ' : ''}{testResult.msg}
                </p>
              )}
              <button
                onClick={handleTest}
                disabled={testing}
                className="w-full mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/30 text-white hover:bg-blue-500/50 disabled:opacity-40 transition-colors"
              >
                {testing ? t('settings.ai.testing') : t('settings.ai.test')}
              </button>
            </TabContent>
          )}

          {tab === 'personality' && (
            <TabContent key="personality">
              <Label>{t('settings.personality.userName')}</Label>
              <input
                value={config.userName}
                onChange={(e) => config.setUserName(e.target.value)}
                className="input-field"
                placeholder={t('settings.personality.userNamePlaceholder')}
              />
              <div className="flex items-center justify-between mt-2 mb-3">
                <span className="text-white/60 text-xs">{t('settings.personality.thirdPerson')}</span>
                <button
                  onClick={() => config.setThirdPerson(!config.thirdPerson)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    config.thirdPerson ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.thirdPerson ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <Slider
                label={t('settings.personality.concise')}
                value={config.verbosity}
                onChange={(v) => config.setPersonality('verbosity', v)}
              />
              <Slider
                label={t('settings.personality.formal')}
                value={config.formality}
                onChange={(v) => config.setPersonality('formality', v)}
              />
              <Slider
                label={t('settings.personality.cautious')}
                value={config.proactivity}
                onChange={(v) => config.setPersonality('proactivity', v)}
              />
              <div className="flex flex-wrap gap-1 mt-3">
                {[
                  { name: t('settings.personality.default'), v: 0.3, f: 0.7, p: 0.3 },
                  { name: t('settings.personality.professional'), v: 0.2, f: 0.2, p: 0.2 },
                  { name: t('settings.personality.lively'), v: 0.8, f: 0.9, p: 0.7 },
                  { name: t('settings.personality.minimal'), v: 0.1, f: 0.3, p: 0.1 },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      config.setPersonality('verbosity', preset.v)
                      config.setPersonality('formality', preset.f)
                      config.setPersonality('proactivity', preset.p)
                    }}
                    className="px-3 py-1 rounded-full text-xs bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </TabContent>
          )}

          {tab === 'memory' && (
            <TabContent key="memory">
              <MemoryViewer />
            </TabContent>
          )}

          {tab === 'general' && (
            <TabContent key="general">
              <Label>{t('settings.general.language')}</Label>
              <select
                value={config.language}
                onChange={(e) => config.setLanguage(e.target.value as 'zh' | 'en' | 'auto')}
                className="input-field"
              >
                <option value="auto">{t('settings.general.auto')}</option>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white/60 text-xs">{t('settings.general.sound')}</span>
                <Toggle value={config.soundEnabled} onChange={() => config.setSoundEnabled(!config.soundEnabled)} />
              </div>
              <Label>{t('settings.general.screenTime')}</Label>
              <select
                value={config.screenTimeReminder}
                onChange={(e) => config.setScreenTimeReminder(Number(e.target.value))}
                className="input-field"
              >
                <option value={0}>{t('settings.general.screenTime.off')}</option>
                <option value={30}>{t('settings.general.screenTime.30')}</option>
                <option value={60}>{t('settings.general.screenTime.60')}</option>
                <option value={120}>{t('settings.general.screenTime.120')}</option>
              </select>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white/60 text-xs">{t('settings.general.tts')}</span>
                <Toggle value={config.ttsEnabled} onChange={() => config.setTtsEnabled(!config.ttsEnabled)} />
              </div>

              {/* ── Vision (YOLO + OCR) ── */}
              <FeatureSection
                title={lang === 'zh' ? '视觉分析 (YOLO + OCR)' : 'Vision (YOLO + OCR)'}
                description={lang === 'zh' ? '下载 ~13MB 模型后可用' : 'Download ~13MB model to enable'}
              >
                <VisionSetup lang={lang} />
              </FeatureSection>

              {/* ── STT (Whisper) ── */}
              <FeatureSection
                title={lang === 'zh' ? '语音输入 (Whisper)' : 'Voice Input (Whisper)'}
                description={lang === 'zh' ? '下载模型后可用 Alt+M' : 'Download model to enable Alt+M'}
              >
                <STTSetup lang={lang} />
              </FeatureSection>
            </TabContent>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          background: rgba(255,255,255,0.08);
          color: white;
          font-size: 0.75rem;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(255,255,255,0.08);
          outline: none;
        }
        .input-field:focus {
          border-color: rgba(96,165,250,0.5);
        }
      `}</style>
    </motion.div>
  )
}

function TabContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-white/50 text-xs mb-1 mt-2">{children}</p>
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-white/20'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function FeatureSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
      <p className="text-white/80 text-xs font-medium">{title}</p>
      <p className="text-white/30 text-[10px] mb-2">{description}</p>
      {children}
    </div>
  )
}

function StatusDot({ status }: { status: 'ready' | 'loading' | 'error' | 'idle' }) {
  const colors = { ready: 'bg-green-400', loading: 'bg-yellow-400 animate-pulse', error: 'bg-red-400', idle: 'bg-white/20' }
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status]}`} />
}

function VisionSetup({ lang }: { lang: string }) {
  const config = useConfigStore()
  const [status, setStatus] = useState<'checking' | 'not-downloaded' | 'downloading' | 'ready' | 'error'>('checking')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    window.electronAPI?.visionStatus().then((s) => {
      if (!cancelled) setStatus(s.initialized ? 'ready' : 'not-downloaded')
    }).catch(() => {
      if (!cancelled) setStatus('not-downloaded')
    })
    return () => { cancelled = true }
  }, [])

  const handleDownload = async () => {
    setStatus('downloading')
    setErrorMsg('')
    try {
      const result = await window.electronAPI?.visionInit()
      if (result && !result.success) {
        setStatus('error')
        setErrorMsg(result.error || 'Init failed')
        return
      }
      setStatus('ready')
      // Auto-enable vision after successful download
      useConfigStore.getState().setVisionEnabled(true)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const dotStatus = status === 'ready' ? 'ready' as const
    : status === 'downloading' ? 'loading' as const
    : status === 'error' ? 'error' as const
    : 'idle' as const

  const statusText: Record<string, string> = {
    checking: lang === 'zh' ? '检查中...' : 'Checking...',
    'not-downloaded': lang === 'zh' ? '未下载' : 'Not downloaded',
    downloading: lang === 'zh' ? '下载中...' : 'Downloading...',
    ready: lang === 'zh' ? '已就绪' : 'Ready',
    error: lang === 'zh' ? '下载失败' : 'Download failed',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusDot status={dotStatus} />
          <span className="text-[10px] text-white/50">{statusText[status]}</span>
        </div>
        {status === 'ready' && (
          <Toggle value={config.visionEnabled} onChange={() => config.setVisionEnabled(!config.visionEnabled)} />
        )}
      </div>
      {(status === 'not-downloaded' || status === 'error') && (
        <button
          onClick={handleDownload}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/30 text-white hover:bg-blue-500/50 transition-colors"
        >
          {lang === 'zh' ? '下载模型 (~13MB)' : 'Download Model (~13MB)'}
        </button>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-[10px] text-red-400/80">{errorMsg.slice(0, 100)}</p>
      )}
    </div>
  )
}

function STTSetup({ lang }: { lang: string }) {
  const config = useConfigStore()
  const [status, setStatus] = useState<'checking' | 'not-downloaded' | 'downloading' | 'ready' | 'error'>('checking')
  const [progress, setProgress] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    window.electronAPI?.sttStatus().then((s) => {
      if (!cancelled) setStatus(s.initialized ? 'ready' : 'not-downloaded')
    }).catch(() => {
      if (!cancelled) setStatus('not-downloaded')
    })
    return () => { cancelled = true }
  }, [])

  const handleDownload = async () => {
    const api = window.electronAPI
    if (!api) return
    setStatus('downloading')
    setProgress(0)
    setErrorMsg('')

    api.onSttProgress((p) => {
      if (p.progress != null) setProgress(Math.round(p.progress))
    })

    try {
      const result = await api.sttInit(config.sttModel)
      if (!result.success) {
        setStatus('error')
        setErrorMsg(result.error || '')
      } else {
        setStatus('ready')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setProgress(null)
      api.offSttProgress()
    }
  }

  const handleModelChange = async (newModel: string) => {
    config.setSttModel(newModel)
    // If already initialized, need re-download
    if (status === 'ready') {
      setStatus('not-downloaded')
      config.setVisionEnabled(false) // reset until re-downloaded
    }
  }

  const dotStatus = status === 'ready' ? 'ready' as const
    : status === 'downloading' ? 'loading' as const
    : status === 'error' ? 'error' as const
    : 'idle' as const

  const modelSizes: Record<string, string> = {
    'Xenova/whisper-tiny': '~75MB',
    'Xenova/whisper-base': '~150MB',
    'Xenova/whisper-small': '~500MB',
  }

  const statusText: Record<string, string> = {
    checking: lang === 'zh' ? '检查中...' : 'Checking...',
    'not-downloaded': lang === 'zh' ? '未下载' : 'Not downloaded',
    downloading: progress != null ? `${progress}%` : (lang === 'zh' ? '下载中...' : 'Downloading...'),
    ready: lang === 'zh' ? '已就绪' : 'Ready',
    error: lang === 'zh' ? '下载失败' : 'Download failed',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <StatusDot status={dotStatus} />
        <span className="text-[10px] text-white/50">{statusText[status]}</span>
      </div>

      {/* Progress bar */}
      {status === 'downloading' && progress != null && (
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Model selector */}
      <div className="text-[10px] text-white/40 mb-0.5">{lang === 'zh' ? '模型' : 'Model'}</div>
      <select
        value={config.sttModel}
        onChange={(e) => handleModelChange(e.target.value)}
        disabled={status === 'downloading'}
        className="input-field"
      >
        <option value="Xenova/whisper-tiny">Tiny (~75MB, {lang === 'zh' ? '快' : 'fast'})</option>
        <option value="Xenova/whisper-base">Base (~150MB, {lang === 'zh' ? '更准' : 'accurate'})</option>
        <option value="Xenova/whisper-small">Small (~500MB, {lang === 'zh' ? '最准' : 'best'})</option>
      </select>

      {/* Language selector — always visible */}
      <div className="text-[10px] text-white/40 mb-0.5">{lang === 'zh' ? '识别语言' : 'Language'}</div>
      <select
        value={config.sttLanguage}
        onChange={(e) => config.setSttLanguage(e.target.value as 'auto' | 'zh' | 'en')}
        className="input-field"
      >
        <option value="auto">{lang === 'zh' ? '自动' : 'Auto'}</option>
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>

      {/* Download button */}
      {(status === 'not-downloaded' || status === 'error') && (
        <button
          onClick={handleDownload}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/30 text-white hover:bg-blue-500/50 transition-colors"
        >
          {lang === 'zh'
            ? `下载模型 (${modelSizes[config.sttModel] || '~75MB'})`
            : `Download (${modelSizes[config.sttModel] || '~75MB'})`}
        </button>
      )}

      {status === 'error' && errorMsg && (
        <p className="text-[10px] text-red-400/80">{errorMsg.slice(0, 100)}</p>
      )}

      {/* Hint when ready */}
      {status === 'ready' && (
        <p className="text-[10px] text-green-400/60">{lang === 'zh' ? '按 Alt+M 或点麦克风图标开始说话' : 'Press Alt+M or click mic to speak'}</p>
      )}
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-white/60 text-xs">{label}</span>
        <span className="text-white/30 text-xs">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        className="w-full h-1 rounded-full appearance-none bg-white/30 hover:bg-white/40 accent-blue-400 transition-colors"
      />
    </div>
  )
}
