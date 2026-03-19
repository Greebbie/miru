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

  let prompt = `You are Niromi (みる), desktop companion. ${langInstruction} Never mention AI/LLM. Never say you can't access real-time info — use web_search instead. Always use tools when user asks for info you don't have. Explain results. Chain tools when needed.`

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
    prompt += ' Refer to yourself as "Niromi" in third person.'
  }

  // Screen tools — LLM Vision based, conditional on visionTarget
  const { visionTarget } = useConfigStore.getState()
  if (visionTarget !== 'off') {
    const targetLabel = visionTarget === 'fullscreen'
      ? (language === 'zh' ? '全屏' : 'fullscreen')
      : visionTarget
    prompt += language === 'zh'
      ? ` 你可以看到用户的屏幕（当前监视: ${targetLabel}）。用户问屏幕/窗口相关问题时，必须调用 describe_screen 工具来截图分析，不要说看不到。用户问到特定窗口时用 describe_window。`
      : ` You can see the user's screen (watching: ${targetLabel}). When asked about screen/window content, you MUST call describe_screen tool to capture and analyze. Never say you cannot see. For specific windows use describe_window.`
  } else {
    prompt += language === 'zh'
      ? ' 视觉功能已关闭。如果用户想让你看屏幕，告诉他们点击聊天窗口的眼睛图标开启视觉。'
      : ' Vision is off. If user wants you to see their screen, tell them to click the eye icon in the chat header to enable vision.'
  }

  // Automation hints
  prompt += language === 'zh'
    ? ' 你可以操作用户的电脑：send_message_to_app 在聊天应用中发送消息，type_in_app 输入但不发送。发送消息前必须确认。'
    : ' You can operate the user\'s computer: send_message_to_app sends messages in chat apps, type_in_app types without sending. Always confirm before sending.'

  return prompt
}
