import { create } from 'zustand'
import { CONFIG_PERSIST_DEBOUNCE_MS } from '@/core/constants'

export type AIProviderType = 'claude' | 'openai' | 'deepseek' | 'ollama' | 'vllm' | 'qwen' | 'minimax'

export type AITask = 'chat' | 'vision' | 'monitoring' | 'factExtraction'

/** Per-task model override. Empty/missing fields inherit from main config. */
export interface TaskRouteConfig {
  provider?: AIProviderType
  model?: string
  apiKey?: string
  baseUrl?: string
  groupId?: string
}

interface ConfigData {
  provider: AIProviderType
  apiKey: string
  model: string
  baseUrl: string
  groupId: string
  verbosity: number
  formality: number
  proactivity: number
  language: 'zh' | 'en' | 'auto'
  soundEnabled: boolean
  visionTarget: 'off' | 'fullscreen' | string  // 'off' | 'fullscreen' | window name
  ttsEnabled: boolean
  isOnboarded: boolean
  userName: string
  thirdPerson: boolean
  screenTimeReminder: number  // 0=off, 30/60/120 minutes
  tokenBudget: 'minimal' | 'balanced' | 'smart'
  sttModel: string
  sttLanguage: 'auto' | 'zh' | 'en'
  /** Per-task model routing overrides */
  modelRouting: Partial<Record<AITask, TaskRouteConfig>>
}

interface ConfigState extends ConfigData {
  isLoading: boolean

  init: () => Promise<void>
  setProvider: (provider: AIProviderType) => void
  setApiKey: (key: string) => void
  setModel: (model: string) => void
  setBaseUrl: (url: string) => void
  setGroupId: (id: string) => void
  setPersonality: (key: 'verbosity' | 'formality' | 'proactivity', value: number) => void
  setLanguage: (lang: 'zh' | 'en' | 'auto') => void
  setSoundEnabled: (enabled: boolean) => void
  setVisionTarget: (target: 'off' | 'fullscreen' | string) => void
  /** @deprecated use setVisionTarget */
  setVisionEnabled: (enabled: boolean) => void
  setTtsEnabled: (enabled: boolean) => void
  setOnboarded: (onboarded: boolean) => void
  setUserName: (name: string) => void
  setThirdPerson: (v: boolean) => void
  setScreenTimeReminder: (minutes: number) => void
  setTokenBudget: (budget: 'minimal' | 'balanced' | 'smart') => void
  setSttModel: (model: string) => void
  setSttLanguage: (lang: 'auto' | 'zh' | 'en') => void
  setModelRouting: (routing: Partial<Record<AITask, TaskRouteConfig>>) => void
  setTaskRoute: (task: AITask, config: TaskRouteConfig | undefined) => void
  updateConfig: (partial: Partial<ConfigState>) => void
}

function extractData(state: ConfigState): ConfigData {
  return {
    provider: state.provider,
    apiKey: state.apiKey,
    model: state.model,
    baseUrl: state.baseUrl,
    groupId: state.groupId,
    verbosity: state.verbosity,
    formality: state.formality,
    proactivity: state.proactivity,
    language: state.language,
    soundEnabled: state.soundEnabled,
    visionTarget: state.visionTarget,
    ttsEnabled: state.ttsEnabled,
    isOnboarded: state.isOnboarded,
    userName: state.userName,
    thirdPerson: state.thirdPerson,
    screenTimeReminder: state.screenTimeReminder,
    tokenBudget: state.tokenBudget,
    sttModel: state.sttModel,
    sttLanguage: state.sttLanguage,
    modelRouting: state.modelRouting,
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

function persistConfig() {
  // Don't persist while still loading (prevents overwriting saved config with defaults)
  if (useConfigStore.getState().isLoading) return
  // Debounce: coalesce rapid changes into one write
  if (persistTimer !== null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const data = extractData(useConfigStore.getState())
    window.electronAPI?.storeSet('config', data)
  }, CONFIG_PERSIST_DEBOUNCE_MS)
}

export const useConfigStore = create<ConfigState>((set) => ({
  provider: 'claude',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  baseUrl: '',
  groupId: '',
  verbosity: 0.3,
  formality: 0.7,
  proactivity: 0.3,
  language: 'zh',
  soundEnabled: false,
  visionTarget: 'off',
  ttsEnabled: false,
  isOnboarded: false,
  userName: '',
  thirdPerson: false,
  screenTimeReminder: 0,
  tokenBudget: 'balanced',
  sttModel: 'Xenova/whisper-tiny',
  sttLanguage: 'auto',
  modelRouting: {},
  isLoading: true,

  init: async () => {
    try {
      const saved = await window.electronAPI?.storeGet('config') as Partial<ConfigData & { visionEnabled?: boolean }> | undefined
      if (saved) {
        // Migrate old visionEnabled boolean → visionTarget
        if ('visionEnabled' in saved && !('visionTarget' in saved)) {
          (saved as any).visionTarget = saved.visionEnabled ? 'fullscreen' : 'off'
          delete (saved as any).visionEnabled
        }
        set({ ...saved, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  setProvider: (provider) => { set({ provider }); persistConfig() },
  setApiKey: (apiKey) => { set({ apiKey }); persistConfig() },
  setModel: (model) => { set({ model }); persistConfig() },
  setBaseUrl: (baseUrl) => { set({ baseUrl }); persistConfig() },
  setGroupId: (groupId) => { set({ groupId }); persistConfig() },
  setPersonality: (key, value) => { set({ [key]: Math.max(0, Math.min(1, value)) }); persistConfig() },
  setLanguage: (language) => { set({ language }); persistConfig() },
  setSoundEnabled: (soundEnabled) => { set({ soundEnabled }); persistConfig() },
  setVisionTarget: (visionTarget) => { set({ visionTarget }); persistConfig() },
  setVisionEnabled: (enabled) => { set({ visionTarget: enabled ? 'fullscreen' : 'off' }); persistConfig() },
  setTtsEnabled: (ttsEnabled) => { set({ ttsEnabled }); persistConfig() },
  setOnboarded: (isOnboarded) => { set({ isOnboarded }); persistConfig() },
  setUserName: (userName) => { set({ userName }); persistConfig() },
  setThirdPerson: (thirdPerson) => { set({ thirdPerson }); persistConfig() },
  setScreenTimeReminder: (screenTimeReminder) => { set({ screenTimeReminder }); persistConfig() },
  setTokenBudget: (tokenBudget) => { set({ tokenBudget }); persistConfig() },
  setSttModel: (sttModel) => { set({ sttModel }); persistConfig() },
  setSttLanguage: (sttLanguage) => { set({ sttLanguage }); persistConfig() },
  setModelRouting: (modelRouting) => { set({ modelRouting }); persistConfig() },
  setTaskRoute: (task, config) => {
    set((state) => {
      const routing = { ...state.modelRouting }
      if (config) {
        routing[task] = config
      } else {
        delete routing[task]
      }
      return { modelRouting: routing }
    })
    persistConfig()
  },
  updateConfig: (partial) => { set(partial); persistConfig() },
}))
