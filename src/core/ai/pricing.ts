// Pricing per 1M tokens [input, output] in USD
const PRICING: Record<string, Record<string, [number, number]>> = {
  claude: {
    'claude-sonnet-4-20250514': [3, 15],
    'claude-sonnet-4': [3, 15],
    'claude-haiku-3.5': [0.8, 4],
    'claude-haiku-4-5-20251001': [0.8, 4],
  },
  openai: {
    'gpt-4o': [2.5, 10],
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4.1': [2, 8],
  },
  deepseek: {
    'deepseek-chat': [0.14, 0.28],
    'deepseek-reasoner': [0.55, 2.19],
  },
  ollama: {},
  vllm: {},
  qwen: {
    'qwen-turbo': [0.5, 1.5],
    'qwen-plus': [0.8, 2],
  },
  minimax: {
    'abab6.5-chat': [0.5, 1.5],
  },
}

// Default per-provider fallback [input, output] per 1M tokens
const DEFAULTS: Record<string, [number, number]> = {
  claude: [3, 15],
  openai: [2.5, 10],
  deepseek: [0.14, 0.28],
  ollama: [0, 0],
  vllm: [0, 0],
  qwen: [0.5, 1.5],
  minimax: [0.5, 1.5],
}

export function calculateCost(tokensIn: number, tokensOut: number, provider: string, model: string): number {
  const providerPricing = PRICING[provider]
  const rates = providerPricing?.[model] || DEFAULTS[provider] || [0, 0]
  return (tokensIn * rates[0] + tokensOut * rates[1]) / 1_000_000
}
