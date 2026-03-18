import { useState, useEffect, forwardRef } from 'react'
import { useConfigStore } from '@/stores/configStore'
import { isVisionCapable } from '@/core/ai/createProvider'
import { useI18n } from '@/i18n/useI18n'

interface VisionPanelProps {
  anchorEl: HTMLElement
  onClose: () => void
}

const VisionPanel = forwardRef<HTMLDivElement, VisionPanelProps>(
  function VisionPanel({ anchorEl, onClose }, ref) {
    const { visionTarget, setVisionTarget } = useConfigStore()
    const [windowList, setWindowList] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(false)
    const { lang } = useI18n()
    const visionCapable = isVisionCapable()

    const fetchWindows = async () => {
      if (!window.electronAPI) return
      setLoading(true)
      try {
        const list = await window.electronAPI.getWindowList()
        setWindowList(list)
      } catch {
        setWindowList([])
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      fetchWindows()
    }, [])

    // Position below the anchor button
    const rect = anchorEl.getBoundingClientRect()
    const panelStyle: React.CSSProperties = {
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      width: 208,
      background: 'rgba(30, 30, 40, 0.98)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      borderRadius: 8,
      zIndex: 10000,
    }

    const isWindowMode = visionTarget !== 'off' && visionTarget !== 'fullscreen'

    const handleSelect = (target: 'off' | 'fullscreen' | string) => {
      setVisionTarget(target)
      if (target !== 'off' && target !== 'fullscreen') {
        onClose()
      }
    }

    return (
      <div ref={ref} style={panelStyle}>
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
          <span className="text-white/80 text-xs font-medium">
            {lang === 'zh' ? '\uD83D\uDC41 \u89C6\u89C9\u6A21\u5F0F' : '\uD83D\uDC41 Vision Mode'}
          </span>
          <button
            onClick={fetchWindows}
            className="text-white/30 hover:text-white/60 text-xs transition-colors"
            title={lang === 'zh' ? '\u5237\u65B0' : 'Refresh'}
            disabled={loading}
          >
            {'\u21BB'}
          </button>
        </div>

        {!visionCapable && (
          <div className="px-2.5 py-1.5 text-[10px] text-yellow-400/80 bg-yellow-400/5">
            {lang === 'zh' ? '\u5F53\u524D\u6A21\u578B\u4E0D\u652F\u6301\u89C6\u89C9' : 'Current model does not support vision'}
          </div>
        )}

        <div className="p-1.5 space-y-0.5">
          {/* Off */}
          <RadioOption
            selected={visionTarget === 'off'}
            onClick={() => handleSelect('off')}
            label={lang === 'zh' ? '\u5173\u95ED' : 'Off'}
            color="text-white/40"
          />

          {/* Fullscreen */}
          <RadioOption
            selected={visionTarget === 'fullscreen'}
            onClick={() => handleSelect('fullscreen')}
            label={lang === 'zh' ? '\u5168\u5C4F' : 'Fullscreen'}
            color="text-blue-400"
          />

          {/* Window mode */}
          <RadioOption
            selected={isWindowMode}
            onClick={() => {
              if (!isWindowMode && windowList.length > 0) {
                handleSelect(windowList[0].name)
              }
            }}
            label={lang === 'zh' ? '\u6307\u5B9A\u7A97\u53E3' : 'Specific window'}
            color="text-green-400"
          />

          {/* Window list */}
          {(isWindowMode || visionTarget === 'fullscreen') && (
            <div className="ml-4 mt-0.5 max-h-28 overflow-y-auto space-y-0.5">
              {loading && (
                <p className="text-[10px] text-white/30 px-1.5">
                  {lang === 'zh' ? '\u52A0\u8F7D\u4E2D...' : 'Loading...'}
                </p>
              )}
              {!loading && windowList.length === 0 && (
                <p className="text-[10px] text-white/30 px-1.5">
                  {lang === 'zh' ? '\u672A\u627E\u5230\u7A97\u53E3' : 'No windows found'}
                </p>
              )}
              {!loading && windowList.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleSelect(w.name)}
                  className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] transition-colors truncate ${
                    visionTarget === w.name
                      ? 'bg-green-500/20 text-green-300'
                      : 'text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                  title={w.name}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  },
)

export default VisionPanel

function RadioOption({
  selected,
  onClick,
  label,
  color,
}: {
  selected: boolean
  onClick: () => void
  label: string
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-xs transition-colors ${
        selected ? 'bg-white/10' : 'hover:bg-white/5'
      }`}
    >
      <span className={`w-3 h-3 rounded-full border flex items-center justify-center ${
        selected ? 'border-blue-400' : 'border-white/20'
      }`}>
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
      </span>
      <span className={selected ? color : 'text-white/50'}>{label}</span>
    </button>
  )
}
