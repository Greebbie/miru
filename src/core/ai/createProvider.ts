import { useConfigStore, type AIProviderType, type AITask } from '@/stores/configStore'
import type { AIProvider } from './provider'
import { ClaudeProvider } from './claude'
import { OpenAIProvider } from './openai'
import { DeepSeekProvider } from './deepseek'
import { OllamaProvider } from './ollama'
import { VLLMProvider } from './vllm'
import { QwenProvider } from './qwen'
import { MinimaxProvider } from './minimax'

// Blacklist mode: only providers known to lack vision support need OCR fallback
const NON_VISION_PROVIDERS = new Set(['vllm'])

export function isVisionCapable(): boolean {
  const config = useConfigStore.getState()
  const visionRoute = config.modelRouting.vision
  const provider = visionRoute?.provider || config.provider
  return !NON_VISION_PROVIDERS.has(provider)
}

/** Resolve effective config for a task, falling back to main config */
function resolveTaskConfig(task?: AITask) {
  const config = useConfigStore.getState()
  if (!task) {
    return { provider: config.provider, apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl, groupId: config.groupId }
  }
  const route = config.modelRouting[task]
  return {
    provider: route?.provider || config.provider,
    apiKey: route?.apiKey || config.apiKey,
    model: route?.model || config.model,
    baseUrl: route?.baseUrl || config.baseUrl,
    groupId: route?.groupId || config.groupId,
  }
}

/**
 * Create an AI provider instance.
 * @param task Optional task type for model routing (chat, vision, monitoring, factExtraction).
 *             When provided, uses per-task override config if set, otherwise falls back to main config.
 */
export function createProvider(task?: AITask): AIProvider | null {
  const { provider, apiKey, model, baseUrl, groupId } = resolveTaskConfig(task)

  return buildProvider(provider, apiKey, model, baseUrl, groupId)
}

function buildProvider(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  baseUrl: string,
  groupId: string,
): AIProvider | null {
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
