import { useConfigStore } from '@/stores/configStore'

/**
 * Build dynamic system prompt based on personality sliders.
 * Budget: ~45 tokens worst case, well within 200 token limit.
 */
export function buildSystemPrompt(): string {
  const { verbosity, formality, proactivity, language } = useConfigStore.getState()

  const langInstruction = language === 'en' ? 'Reply in English.'
    : language === 'zh' ? '用中文回复。'
    : 'Reply in user\'s language.'

  let prompt = `You are Miru (みる), desktop companion. ${langInstruction} Never mention AI/LLM. Never say you can't access real-time info — use web_search instead. Always use tools when user asks for info you don't have. Explain results. Chain tools when needed.`

  // Verbosity
  if (verbosity < 0.3) {
    prompt += ' Ultra-brief, max 2 sentences.'
  } else if (verbosity > 0.7) {
    prompt += ' Explain in detail when helpful.'
  }

  // Formality
  if (formality < 0.3) {
    prompt += ' Casual tone, use emoji.'
  } else if (formality > 0.7) {
    prompt += ' Professional, polite.'
  } else {
    prompt += ' Warm, playful.'
  }

  // Proactivity
  if (proactivity > 0.6) {
    prompt += ' Suggest next steps proactively.'
  }

  // User name
  const { userName, thirdPerson } = useConfigStore.getState()
  if (userName) {
    prompt += ` User's name: ${userName}.`
  }

  // Third person mode
  if (thirdPerson) {
    prompt += ' Refer to yourself as "Miru" in third person.'
  }

  // Vision capability declaration
  const { visionEnabled } = useConfigStore.getState()
  if (visionEnabled) {
    prompt += language === 'zh'
      ? ' 你可以看到用户的屏幕。用户问屏幕相关问题时，使用 describe_screen 工具。'
      : ' You can see the user\'s screen. Use describe_screen tool when asked about screen content.'
  }

  return prompt
}
