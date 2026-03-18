import { create } from 'zustand'

export type AIProviderType = 'claude' | 'openai' | 'deepseek' | 'ollama' | 'vllm' | 'qwen' | 'minimax'

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
  visionEnabled: boolean
  ttsEnabled: boolean
  isOnboarded: boolean
  userName: string
  thirdPerson: boolean
  screenTimeReminder: number  // 0=off, 30/60/120 minutes
  tokenBudget: 'minimal' | 'balanced' | 'smart'
  sttModel: string
  sttLanguage: 'auto' | 'zh' | 'en'
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
  setVisionEnabled: (enabled: boolean) => void
  setTtsEnabled: (enabled: boolean) => void
  setOnboarded: (onboarded: boolean) => void
  setUserName: (name: string) => void
  setThirdPerson: (v: boolean) => void
  setScreenTimeReminder: (minutes: number) => void
  setTokenBudget: (budget: 'minimal' | 'balanced' | 'smart') => void
  setSttModel: (model: string) => void
  setSttLanguage: (lang: 'auto' | 'zh' | 'en') => void
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
    visionEnabled: state.visionEnabled,
    ttsEnabled: state.ttsEnabled,
    isOnboarded: state.isOnboarded,
    userName: state.userName,
    thirdPerson: state.thirdPerson,
    screenTimeReminder: state.screenTimeReminder,
    tokenBudget: state.tokenBudget,
    sttModel: state.sttModel,
    sttLanguage: state.sttLanguage,
  }
}

function persistConfig() {
  const data = extractData(useConfigStore.getState())
  window.electronAPI?.storeSet('config', data)
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
  visionEnabled: false,
  ttsEnabled: false,
  isOnboarded: false,
  userName: '',
  thirdPerson: false,
  screenTimeReminder: 0,
  tokenBudget: 'balanced',
  sttModel: 'Xenova/whisper-tiny',
  sttLanguage: 'auto',
  isLoading: true,

  init: async () => {
    try {
      const saved = await window.electronAPI?.storeGet('config') as Partial<ConfigData> | undefined
      if (saved) {
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
  setVisionEnabled: (visionEnabled) => { set({ visionEnabled }); persistConfig() },
  setTtsEnabled: (ttsEnabled) => { set({ ttsEnabled }); persistConfig() },
  setOnboarded: (isOnboarded) => { set({ isOnboarded }); persistConfig() },
  setUserName: (userName) => { set({ userName }); persistConfig() },
  setThirdPerson: (thirdPerson) => { set({ thirdPerson }); persistConfig() },
  setScreenTimeReminder: (screenTimeReminder) => { set({ screenTimeReminder }); persistConfig() },
  setTokenBudget: (tokenBudget) => { set({ tokenBudget }); persistConfig() },
  setSttModel: (sttModel) => { set({ sttModel }); persistConfig() },
  setSttLanguage: (sttLanguage) => { set({ sttLanguage }); persistConfig() },
  updateConfig: (partial) => { set(partial); persistConfig() },
}))
