import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfigStore, type AIProviderType } from '@/stores/configStore'
import { useChatStore } from '@/stores/chatStore'
import { humanizeError } from '@/core/errors/humanize'
import { testConnection } from '@/core/ai/testConnection'
import { useI18n } from '@/i18n/useI18n'

const STEPS = ['intro', 'provider', 'apikey', 'features', 'scenarios', 'done'] as const
type Step = typeof STEPS[number]

interface ProviderInfo {
  id: AIProviderType
  name: string
  placeholder: string
  needsKey: boolean
  needsBaseUrl: boolean
  needsGroupId: boolean
  defaultBaseUrl?: string
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'claude', name: 'Claude (Anthropic)', placeholder: 'sk-ant-...', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'ollama', name: 'Ollama', placeholder: '', needsKey: false, needsBaseUrl: true, needsGroupId: false, defaultBaseUrl: 'http://localhost:11434/v1' },
  { id: 'vllm', name: 'vLLM', placeholder: '', needsKey: false, needsBaseUrl: true, needsGroupId: false, defaultBaseUrl: 'http://localhost:8000/v1' },
  { id: 'qwen', name: 'Qwen', placeholder: 'sk-...', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'minimax', name: 'Minimax', placeholder: 'API Key', needsKey: true, needsBaseUrl: false, needsGroupId: true },
]

export default function Welcome() {
  const [step, setStep] = useState<Step>('intro')
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('claude')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [groupId, setGroupId] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const { setProvider, setApiKey: saveKey, setBaseUrl: saveBaseUrl, setGroupId: saveGroupId, setOnboarded, setLanguage } = useConfigStore()
  const { setPendingPrompt, openChat } = useChatStore()
  const { t, lang } = useI18n()

  const providerInfo = PROVIDERS.find((p) => p.id === selectedProvider)!

  const handleTestAndSave = async () => {
    setTesting(true)
    setTestResult(null)

    // Validate required fields
    if (providerInfo.needsKey && !apiKey.trim()) {
      setTestResult({ ok: false, msg: t('welcome.apiKeyRequired') })
      setTesting(false)
      return
    }
    if (providerInfo.needsGroupId && !groupId.trim()) {
      setTestResult({ ok: false, msg: t('welcome.groupIdRequired') })
      setTesting(false)
      return
    }

    // Test connection
    const error = await testConnection(
      selectedProvider,
      apiKey,
      baseUrl || providerInfo.defaultBaseUrl || '',
      groupId
    )

    if (error) {
      setTestResult({ ok: false, msg: humanizeError(error, lang) })
      setTesting(false)
      return
    }

    // Connection successful — save and proceed
    setTestResult({ ok: true, msg: t('welcome.connected') })
    setProvider(selectedProvider)
    if (providerInfo.needsKey) saveKey(apiKey)
    if (providerInfo.needsBaseUrl) saveBaseUrl(baseUrl || providerInfo.defaultBaseUrl || '')
    if (providerInfo.needsGroupId) saveGroupId(groupId)

    setTimeout(() => setStep('features'), 600)
    setTesting(false)
  }

  const handleComplete = () => {
    setOnboarded(true)
  }

  const toggleLanguage = () => {
    setLanguage(lang === 'zh' ? 'en' : 'zh')
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        className="w-[340px] rounded-2xl p-6 relative"
        style={{
          background: 'rgba(30, 30, 40, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <StepContainer key="intro">
              {/* Language toggle */}
              <button
                onClick={toggleLanguage}
                className="absolute top-4 right-4 px-2 py-1 rounded-lg text-xs bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/90 transition-colors"
              >
                {lang === 'zh' ? 'EN' : '中'}
              </button>
              <div className="text-4xl text-center mb-4">{'\uD83C\uDF1F'}</div>
              <h1 className="text-white text-lg font-bold text-center mb-2">
                {t('welcome.hello')}
              </h1>
              <p className="text-white/60 text-sm text-center mb-6">
                {t('welcome.intro')}
              </p>
              <button onClick={() => setStep('provider')} className="btn-primary w-full">
                {t('welcome.start')}
              </button>
            </StepContainer>
          )}

          {step === 'provider' && (
            <StepContainer key="provider">
              <h2 className="text-white text-base font-bold mb-4">{t('welcome.selectAI')}</h2>
              <div className="space-y-2 mb-4 max-h-[240px] overflow-y-auto">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProvider(p.id)
                      if (p.defaultBaseUrl) setBaseUrl(p.defaultBaseUrl)
                      else setBaseUrl('')
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                      selectedProvider === p.id
                        ? 'bg-blue-500/30 text-white border border-blue-400/50'
                        : 'bg-white/5 text-white/70 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('apikey')} className="btn-primary w-full">
                {t('welcome.next')}
              </button>
            </StepContainer>
          )}

          {step === 'apikey' && (
            <StepContainer key="apikey">
              <h2 className="text-white text-base font-bold mb-2">{t('welcome.configure')} {providerInfo.name}</h2>

              {providerInfo.needsKey && (
                <>
                  <p className="text-white/40 text-xs mb-1 mt-3">API Key</p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null) }}
                    placeholder={providerInfo.placeholder}
                    className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 mb-2 outline-none border border-white/10 focus:border-blue-400/50 placeholder:text-white/20"
                  />
                </>
              )}

              {providerInfo.needsBaseUrl && (
                <>
                  <p className="text-white/40 text-xs mb-1 mt-3">Base URL</p>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
                    placeholder={providerInfo.defaultBaseUrl}
                    className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 mb-2 outline-none border border-white/10 focus:border-blue-400/50 placeholder:text-white/20"
                  />
                </>
              )}

              {providerInfo.needsGroupId && (
                <>
                  <p className="text-white/40 text-xs mb-1 mt-3">Group ID</p>
                  <input
                    type="text"
                    value={groupId}
                    onChange={(e) => { setGroupId(e.target.value); setTestResult(null) }}
                    placeholder="Group ID"
                    className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 mb-2 outline-none border border-white/10 focus:border-blue-400/50 placeholder:text-white/20"
                  />
                </>
              )}

              {testResult && (
                <p className={`text-xs mb-3 ${testResult.ok ? 'text-green-400/80' : 'text-yellow-400/80'}`}>
                  {testResult.ok ? '\u2705 ' : ''}{testResult.msg}
                </p>
              )}
              <button
                onClick={handleTestAndSave}
                disabled={testing}
                className="btn-primary w-full disabled:opacity-40 mt-2"
              >
                {testing ? t('welcome.testing') : t('welcome.test')}
              </button>
              <button
                onClick={() => { setStep('provider'); setTestResult(null) }}
                className="w-full text-white/40 text-xs mt-2 hover:text-white/60"
              >
                {t('welcome.back')}
              </button>
            </StepContainer>
          )}

          {step === 'features' && (
            <StepContainer key="features">
              <h2 className="text-white text-base font-bold mb-3">{t('welcome.features')}</h2>
              <div className="space-y-2 mb-4 text-sm">
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83D\uDCAC'}</span>{t('welcome.feat.chat')}</p>
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83D\uDEE0'}</span>{t('welcome.feat.tools')}</p>
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83D\uDC41'}</span>{t('welcome.feat.watch')}</p>
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83C\uDFA4'}</span>{t('welcome.feat.voice')}</p>
              </div>
              <p className="text-white/30 text-xs mb-4 text-center">{t('welcome.featHint')}</p>
              <button onClick={() => setStep('scenarios')} className="btn-primary w-full">
                {t('welcome.next')}
              </button>
            </StepContainer>
          )}

          {step === 'scenarios' && (
            <StepContainer key="scenarios">
              <h2 className="text-white text-base font-bold mb-3">{t('welcome.scenarios')}</h2>
              <div className="space-y-2 mb-4">
                {[
                  { icon: '\uD83D\uDCAC', label: t('qa.watchWeChat'), desc: t('qa.watchWeChatDesc') },
                  { icon: '\uD83D\uDC41\uFE0F', label: t('qa.watchWindow'), desc: t('qa.watchWindowDesc') },
                  { icon: '\u26A1', label: t('qa.quickCommand'), desc: t('qa.quickCommandDesc') },
                  { icon: '\uD83E\uDDE9', label: t('qa.manageSkills'), desc: t('qa.manageSkillsDesc') },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
                  >
                    <span className="text-lg">{s.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white/85">{s.label}</div>
                      <div className="text-[10px] text-white/45 truncate">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mb-3 text-center">{t('welcome.scenariosHint')}</p>
              <button onClick={() => setStep('done')} className="btn-primary w-full">
                {t('welcome.begin')} {'\u2728'}
              </button>
            </StepContainer>
          )}

          {step === 'done' && (
            <StepContainer key="done">
              <div className="text-4xl text-center mb-4">{'\uD83C\uDF89'}</div>
              <h2 className="text-white text-lg font-bold text-center mb-2">
                {t('welcome.done')}
              </h2>
              <p className="text-white/60 text-sm text-center mb-4">
                {t('welcome.tryPrompt')}
              </p>
              <div className="space-y-2 mb-4">
                {[
                  t('welcome.example.organize'),
                  t('welcome.example.abilities'),
                  t('welcome.example.hello'),
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setOnboarded(true)
                      setPendingPrompt(example)
                      openChat()
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-blue-400/30 transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <button
                onClick={handleComplete}
                className="w-full text-white/40 text-xs hover:text-white/60 transition-colors"
              >
                {t('welcome.skip')}
              </button>
            </StepContainer>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function StepContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
      <style>{`
        .btn-primary {
          background: rgba(59, 130, 246, 0.8);
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary:hover {
          background: rgba(59, 130, 246, 1);
        }
      `}</style>
    </motion.div>
  )
}
