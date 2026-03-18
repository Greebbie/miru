import { useState, useCallback, useRef, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useAI } from '@/hooks/useAI'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { markUserActive } from '@/hooks/useMonitor'
import { useI18n } from '@/i18n/useI18n'
import SlashMenu from './SlashMenu'
import type { SkillDefinition } from '@/core/skills/registry'

export default function InputBar() {
  const [input, setInput] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const { isStreaming } = useChatStore()
  const { sendMessage, abort } = useAI()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useI18n()

  const pendingPrompt = useChatStore((s) => s.pendingPrompt)
  useEffect(() => {
    if (pendingPrompt) {
      sendMessage(pendingPrompt)
      useChatStore.getState().setPendingPrompt(null)
    }
  }, [pendingPrompt, sendMessage])

  const handleVoiceResult = useCallback(
    (text: string) => {
      sendMessage(text)
    },
    [sendMessage]
  )
  const { isListening, isInitializing, downloadProgress, error: voiceError, toggle: toggleVoice } = useVoiceInput(handleVoiceResult)

  // Listen for Alt+M toggle-voice from main process
  // Use ref to always call latest toggleVoice, register listener once
  const toggleVoiceRef = useRef(toggleVoice)
  toggleVoiceRef.current = toggleVoice
  useEffect(() => {
    const handler = () => toggleVoiceRef.current()
    window.electronAPI?.onToggleVoice(handler)
    return () => {
      window.electronAPI?.offToggleVoice()
    }
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
        placeholder={isStreaming ? t('chat.thinking') : t('chat.placeholder')}
        disabled={isStreaming}
        rows={1}
        className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 resize-none outline-none placeholder:text-white/30 disabled:opacity-50"
        style={{ maxHeight: 80 }}
      />
      {/* Voice button — always available (local Whisper) */}
      <div className="relative shrink-0">
        {voiceError && (
          <div className="absolute bottom-full mb-1 right-0 whitespace-nowrap text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
            {voiceError}
          </div>
        )}
        {isInitializing && downloadProgress && (
          <div className="absolute bottom-full mb-1 right-0 whitespace-nowrap text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">
            {downloadProgress.progress != null
              ? `${Math.round(downloadProgress.progress)}%`
              : downloadProgress.status}
          </div>
        )}
        <button
          onClick={toggleVoice}
          disabled={isInitializing}
          className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors ${
            isInitializing
              ? 'bg-yellow-500/40 text-white/70 animate-pulse'
              : isListening
                ? 'bg-red-500/80 text-white animate-pulse-mic'
                : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'
          }`}
          title={isInitializing ? t('chat.sttLoading') : isListening ? t('chat.stopRecording') : t('chat.voiceInput')}
        >
          {'\uD83C\uDFA4'}
        </button>
      </div>
      {isStreaming ? (
        <button
          onClick={abort}
          className="w-8 h-8 rounded-lg bg-red-500/80 text-white text-sm flex items-center justify-center hover:bg-red-500 transition-colors shrink-0"
          title={t('chat.stop')}
        >
          {'\u25A0'}
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-8 h-8 rounded-lg bg-blue-500/80 text-white text-sm flex items-center justify-center hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {'\u2191'}
        </button>
      )}
    </div>
  )
}
