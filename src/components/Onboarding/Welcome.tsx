import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfigStore, type AIProviderType } from '@/stores/configStore'

const STEPS = ['intro', 'provider', 'apikey', 'features', 'done'] as const
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
  { id: 'ollama', name: 'Ollama (本地)', placeholder: '', needsKey: false, needsBaseUrl: true, needsGroupId: false, defaultBaseUrl: 'http://localhost:11434/v1' },
  { id: 'vllm', name: 'vLLM (本地)', placeholder: '', needsKey: false, needsBaseUrl: true, needsGroupId: false, defaultBaseUrl: 'http://localhost:8000/v1' },
  { id: 'qwen', name: 'Qwen (通义千问)', placeholder: 'sk-...', needsKey: true, needsBaseUrl: false, needsGroupId: false },
  { id: 'minimax', name: 'Minimax', placeholder: 'API Key', needsKey: true, needsBaseUrl: false, needsGroupId: true },
]

export default function Welcome() {
  const [step, setStep] = useState<Step>('intro')
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('claude')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [groupId, setGroupId] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const { setProvider, setApiKey: saveKey, setBaseUrl: saveBaseUrl, setGroupId: saveGroupId, setOnboarded } = useConfigStore()

  const providerInfo = PROVIDERS.find((p) => p.id === selectedProvider)!

  const handleTestAndSave = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // Validate required fields
      if (providerInfo.needsKey && !apiKey.trim()) {
        setTestResult('请填入 API Key')
        setTesting(false)
        return
      }
      if (providerInfo.needsGroupId && !groupId.trim()) {
        setTestResult('请填入 Group ID')
        setTesting(false)
        return
      }

      // Save and proceed
      setProvider(selectedProvider)
      if (providerInfo.needsKey) saveKey(apiKey)
      if (providerInfo.needsBaseUrl) saveBaseUrl(baseUrl || providerInfo.defaultBaseUrl || '')
      if (providerInfo.needsGroupId) saveGroupId(groupId)
      setStep('features')
    } catch {
      setTestResult('Miru 连不上...检查一下配置对不对？')
    } finally {
      setTesting(false)
    }
  }

  const handleComplete = () => {
    setOnboarded(true)
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        className="w-[340px] rounded-2xl p-6"
        style={{
          background: 'rgba(30, 30, 40, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <StepContainer key="intro">
              <div className="text-4xl text-center mb-4">🌟</div>
              <h1 className="text-white text-lg font-bold text-center mb-2">
                你好！我是 Miru
              </h1>
              <p className="text-white/60 text-sm text-center mb-6">
                我是你的桌面小伙伴！让我先做个简单的设置~
              </p>
              <button onClick={() => setStep('provider')} className="btn-primary w-full">
                开始设置
              </button>
            </StepContainer>
          )}

          {step === 'provider' && (
            <StepContainer key="provider">
              <h2 className="text-white text-base font-bold mb-4">选择 AI 服务</h2>
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
                下一步
              </button>
            </StepContainer>
          )}

          {step === 'apikey' && (
            <StepContainer key="apikey">
              <h2 className="text-white text-base font-bold mb-2">配置 {providerInfo.name}</h2>

              {providerInfo.needsKey && (
                <>
                  <p className="text-white/40 text-xs mb-1 mt-3">API Key</p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
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
                    onChange={(e) => setBaseUrl(e.target.value)}
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
                    onChange={(e) => setGroupId(e.target.value)}
                    placeholder="Group ID"
                    className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 mb-2 outline-none border border-white/10 focus:border-blue-400/50 placeholder:text-white/20"
                  />
                </>
              )}

              {testResult && (
                <p className="text-yellow-400/80 text-xs mb-3">{testResult}</p>
              )}
              <button
                onClick={handleTestAndSave}
                disabled={testing}
                className="btn-primary w-full disabled:opacity-40 mt-2"
              >
                {testing ? '测试中...' : '连接'}
              </button>
              <button
                onClick={() => setStep('provider')}
                className="w-full text-white/40 text-xs mt-2 hover:text-white/60"
              >
                返回
              </button>
            </StepContainer>
          )}

          {step === 'features' && (
            <StepContainer key="features">
              <h2 className="text-white text-base font-bold mb-3">Miru 可以做的事</h2>
              <div className="space-y-2 mb-4 text-sm">
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83D\uDCAC'}</span>对话 — 聊天、搜索、写代码、解答问题</p>
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83D\uDEE0'}</span>工具 — 整理文件、打开应用、系统操作</p>
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83D\uDC41'}</span>值守 — 监控窗口、自动回复消息</p>
                <p className="text-white/70"><span className="text-white/40 mr-2">{'\uD83C\uDFA4'}</span>语音 — 说话输入 (Alt+M)，朗读回复</p>
              </div>
              <p className="text-white/30 text-xs mb-4 text-center">输入 / 查看更多命令 · 右键开启管理面板</p>
              <button onClick={() => setStep('done')} className="btn-primary w-full">
                开始使用 Miru {'\u2728'}
              </button>
            </StepContainer>
          )}

          {step === 'done' && (
            <StepContainer key="done">
              <div className="text-4xl text-center mb-4">🎉</div>
              <h2 className="text-white text-lg font-bold text-center mb-2">
                设置完成！
              </h2>
              <p className="text-white/60 text-sm text-center mb-6">
                点击我就可以聊天啦~ 我可以帮你整理文件、打开应用、记住你的习惯！
              </p>
              <button onClick={handleComplete} className="btn-primary w-full">
                开始使用 Miru ✨
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
