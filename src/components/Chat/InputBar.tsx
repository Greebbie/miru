import { useState, useCallback, useRef, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useAI } from '@/hooks/useAI'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { markUserActive } from '@/hooks/useMonitor'
import SlashMenu from './SlashMenu'
import type { SkillDefinition } from '@/core/skills/registry'

export default function InputBar() {
  const [input, setInput] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const { isStreaming } = useChatStore()
  const { sendMessage } = useAI()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleVoiceResult = useCallback(
    (text: string) => {
      sendMessage(text)
    },
    [sendMessage]
  )
  const { isListening, toggle: toggleVoice } = useVoiceInput(handleVoiceResult)

  // Listen for Alt+M toggle-voice from main process
  // Use ref to always call latest toggleVoice, register listener once
  const toggleVoiceRef = useRef(toggleVoice)
  toggleVoiceRef.current = toggleVoice
  useEffect(() => {
    const handler = () => toggleVoiceRef.current()
    window.electronAPI?.onToggleVoice(handler)
    // Note: ipcRenderer.on accumulates — no off API exposed for voice,
    // but this effect runs once so it's safe
  }, [])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return
    markUserActive()
    setInput('')
    setShowSlash(false)
    sendMessage(text)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, isStreaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSlash && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape')) {
        // Let SlashMenu handle these
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !showSlash) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, showSlash]
  )

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    setShowSlash(val.startsWith('/'))
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }

  const handleSlashSelect = useCallback(
    async (skill: SkillDefinition) => {
      setShowSlash(false)
      setInput('')
      if (skill.execute) {
        await skill.execute('')
      } else {
        sendMessage(skill.name)
      }
    },
    [sendMessage]
  )

  return (
    <div className="p-2 border-t border-white/10 flex gap-2 items-end relative">
      {showSlash && (
        <SlashMenu
          filter={input}
          onSelect={handleSlashSelect}
          onClose={() => setShowSlash(false)}
        />
      )}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? 'Miru \u6B63\u5728\u601D\u8003...' : '\u8BF4\u70B9\u4EC0\u4E48... \u8F93\u5165 / \u67E5\u770B\u547D\u4EE4'}
        disabled={isStreaming}
        rows={1}
        className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 resize-none outline-none placeholder:text-white/30 disabled:opacity-50"
        style={{ maxHeight: 80 }}
      />
      {/* Voice button */}
      {typeof window !== 'undefined' && window.webkitSpeechRecognition && (
        <button
          onClick={toggleVoice}
          className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors shrink-0 ${
            isListening
              ? 'bg-red-500/80 text-white animate-pulse-mic'
              : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'
          }`}
          title={isListening ? '\u505C\u6B62\u5F55\u97F3' : '\u8BED\u97F3\u8F93\u5165'}
        >
          {'\uD83C\uDFA4'}
        </button>
      )}
      <button
        onClick={handleSend}
        disabled={isStreaming || !input.trim()}
        className="w-8 h-8 rounded-lg bg-blue-500/80 text-white text-sm flex items-center justify-center hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {'\u2191'}
      </button>
    </div>
  )
}
