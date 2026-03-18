import { useConfigStore } from '@/stores/configStore'
import type { AIProvider } from './provider'
import { ClaudeProvider } from './claude'
import { OpenAIProvider } from './openai'
import { DeepSeekProvider } from './deepseek'
import { OllamaProvider } from './ollama'
import { VLLMProvider } from './vllm'
import { QwenProvider } from './qwen'
import { MinimaxProvider } from './minimax'

const VISION_PROVIDERS = new Set(['claude', 'openai', 'qwen', 'ollama'])

export function isVisionCapable(): boolean {
  return VISION_PROVIDERS.has(useConfigStore.getState().provider)
}

export function createProvider(): AIProvider | null {
  const { provider, apiKey, model, baseUrl, groupId } = useConfigStore.getState()

  switch (provider) {
    case 'claude':
      return apiKey ? new ClaudeProvider(apiKey, model) : null
    case 'openai':
      return apiKey ? new OpenAIProvider(apiKey, model) : null
    case 'deepseek':
      return apiKey ? new DeepSeekProvider(apiKey, model) : null
    case 'ollama':
      return new OllamaProvider(baseUrl || undefined, model || undefined)
    case 'vllm':
      return new VLLMProvider(baseUrl || undefined, model || undefined)
    case 'qwen':
      return apiKey ? new QwenProvider(apiKey, model || undefined) : null
    case 'minimax':
      return apiKey ? new MinimaxProvider(apiKey, groupId || '', model || undefined) : null
    default:
      return null
  }
}
