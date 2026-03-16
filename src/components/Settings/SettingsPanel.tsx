import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfigStore, type AIProviderType } from '@/stores/configStore'
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
  const config = useConfigStore()
  const currentProvider = PROVIDERS.find((p) => p.id === config.provider)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-[360px] max-h-[500px] rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(30, 30, 40, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <span className="text-white text-sm font-medium">设置</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-lg">×</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['ai', 'personality', 'memory', 'general'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === t ? 'text-white border-b-2 border-blue-400' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {{ ai: 'AI', personality: '性格', memory: '记忆', general: '通用' }[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence mode="wait">
          {tab === 'ai' && (
            <TabContent key="ai">
              <Label>AI 服务</Label>
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
                  <Label>API Key</Label>
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
                  <Label>Base URL</Label>
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
                  <Label>Group ID</Label>
                  <input
                    value={config.groupId}
                    onChange={(e) => config.setGroupId(e.target.value)}
                    className="input-field"
                    placeholder="Group ID"
                  />
                </>
              )}

              <Label>Model</Label>
              <input
                value={config.model}
                onChange={(e) => config.setModel(e.target.value)}
                className="input-field"
                placeholder="claude-sonnet-4-20250514"
              />
            </TabContent>
          )}

          {tab === 'personality' && (
            <TabContent key="personality">
              <Slider
                label="简洁 ↔ 话多"
                value={config.verbosity}
                onChange={(v) => config.setPersonality('verbosity', v)}
              />
              <Slider
                label="正式 ↔ 可爱"
                value={config.formality}
                onChange={(v) => config.setPersonality('formality', v)}
              />
              <Slider
                label="谨慎 ↔ 主动"
                value={config.proactivity}
                onChange={(v) => config.setPersonality('proactivity', v)}
              />
              <div className="flex flex-wrap gap-1 mt-3">
                {[
                  { name: '默认', v: 0.3, f: 0.7, p: 0.3 },
                  { name: '专业', v: 0.2, f: 0.2, p: 0.2 },
                  { name: '活泼', v: 0.8, f: 0.9, p: 0.7 },
                  { name: '极简', v: 0.1, f: 0.3, p: 0.1 },
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
              <Label>语言</Label>
              <select
                value={config.language}
                onChange={(e) => config.setLanguage(e.target.value as 'zh' | 'en' | 'auto')}
                className="input-field"
              >
                <option value="auto">自动</option>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white/60 text-xs">音效</span>
                <button
                  onClick={() => config.setSoundEnabled(!config.soundEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    config.soundEnabled ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white/60 text-xs">语音朗读 (TTS)</span>
                <button
                  onClick={() => config.setTtsEnabled(!config.ttsEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    config.ttsEnabled ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.ttsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
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
        className="w-full h-1 rounded-full appearance-none bg-white/20 accent-blue-400"
      />
    </div>
  )
}
