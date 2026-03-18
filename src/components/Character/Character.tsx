import { useEffect, useRef, useCallback, useState } from 'react'
import { useCharacterStore } from '@/stores/characterStore'
import { useChatStore } from '@/stores/chatStore'
import { expressionMap } from './expressions'
import miruPng from '@/assets/miru.png'
import { playSound } from '@/core/sound'

const IMG_WIDTH = 140
const IMG_HEIGHT = 180

// Eye center positions relative to the image (px) — tuned for the 140x180 render
const LEFT_EYE = { x: 56, y: 76 }
const RIGHT_EYE = { x: 77, y: 76 }
const PUPIL_SIZE = 5
const MAX_TRAVEL = 2.5

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export default function Character() {
  const { animationState, decay } = useCharacterStore()
  const { toggleChat } = useChatStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const leftPupilRef = useRef<HTMLDivElement>(null)
  const rightPupilRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [isBlinking, setIsBlinking] = useState(false)
  const isDraggingRef = useRef(false)
  const animDivRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const expr = expressionMap[animationState]

  // Emotion decay every 500ms
  useEffect(() => {
    const interval = setInterval(decay, 500)
    return () => clearInterval(interval)
  }, [decay])

  // Eye tracking via mousemove
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) return
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        // Image is centered in container with 10px padding each side
        const imgLeft = rect.left + 10
        const imgTop = rect.top + 10

        const updatePupil = (pupilEl: HTMLDivElement | null, eyeCenter: { x: number; y: number }) => {
          if (!pupilEl) return
          const ecx = imgLeft + eyeCenter.x
          const ecy = imgTop + eyeCenter.y
          const dx = e.clientX - ecx
          const dy = e.clientY - ecy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const ox = clamp((dx / dist) * Math.min(dist * 0.02, MAX_TRAVEL), -MAX_TRAVEL, MAX_TRAVEL)
          const oy = clamp((dy / dist) * Math.min(dist * 0.02, MAX_TRAVEL), -MAX_TRAVEL, MAX_TRAVEL)
          pupilEl.style.transform = `translate(${ox}px, ${oy}px)`
        }

        updatePupil(leftPupilRef.current, LEFT_EYE)
        updatePupil(rightPupilRef.current, RIGHT_EYE)
      })
    }

    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Reset pupils when eyes become inactive
  useEffect(() => {
    if (!expr.eyesActive) {
      if (leftPupilRef.current) leftPupilRef.current.style.transform = 'translate(0px, 0px)'
      if (rightPupilRef.current) rightPupilRef.current.style.transform = 'translate(0px, 0px)'
    }
  }, [expr.eyesActive])

  // Blink at random intervals (3-7s)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 4000
      timeout = setTimeout(() => {
        setIsBlinking(true)
        setTimeout(() => setIsBlinking(false), 120)
        scheduleBlink()
      }, delay)
    }
    scheduleBlink()
    return () => clearTimeout(timeout)
  }, [])

  // Drag via document-level listeners (not pointer capture).
  // On transparent Electron windows, setPointerCapture breaks because the overlay
  // (z-index:99999) intercepts all pointer events, preventing the captured element
  // from receiving them. Instead we listen on document in capture phase, which
  // guarantees delivery regardless of z-index layering.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    if (animDivRef.current) animDivRef.current.style.animationPlayState = 'paused'
    if (imgRef.current) imgRef.current.style.transition = 'none'

    // Overlay ensures every pixel has alpha > 0 so the OS keeps forwarding events
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.01);cursor:grabbing'
    document.body.appendChild(overlay)

    const winX = e.screenX - e.clientX
    const winY = e.screenY - e.clientY
    const startX = e.screenX
    const startY = e.screenY
    let moved = 0
    let dragRafId: number | null = null
    let ipcPending = false
    let pendingDx = 0
    let pendingDy = 0

    const flushMove = () => {
      dragRafId = null
      if (ipcPending) return
      ipcPending = true
      const p = window.electronAPI?.setWindowPosition(winX + pendingDx, winY + pendingDy)
      if (p && typeof p.then === 'function') {
        p.then(() => { ipcPending = false }, () => { ipcPending = false })
      } else {
        ipcPending = false
      }
    }

    const onMove = (ev: PointerEvent) => {
      pendingDx = ev.screenX - startX
      pendingDy = ev.screenY - startY
      moved = Math.abs(pendingDx) + Math.abs(pendingDy)
      if (dragRafId === null) {
        dragRafId = requestAnimationFrame(flushMove)
      }
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onUp, true)
      overlay.remove()
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId)
      }
      isDraggingRef.current = false
      if (animDivRef.current) animDivRef.current.style.animationPlayState = ''
      if (imgRef.current) imgRef.current.style.transition = ''

      if (moved >= 5) {
        ipcPending = false
        window.electronAPI?.setWindowPosition(winX + pendingDx, winY + pendingDy)
      } else {
        setTimeout(() => {
          playSound('click')
          toggleChat()
        }, 0)
      }
    }

    // Capture phase on document — guaranteed delivery regardless of overlay z-index
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onUp, true)
  }, [toggleChat])

  // Build dynamic glow shadow
  const glowShadow = `0 0 ${20 * expr.glowIntensity}px ${expr.glowColor}${Math.round(expr.glowIntensity * 255).toString(16).padStart(2, '0')},`
    + `0 0 ${40 * expr.glowIntensity}px ${expr.glowColor}${Math.round(expr.glowIntensity * 150).toString(16).padStart(2, '0')}`

  const isIdle = animationState === 'idle'
  const showPupils = expr.eyesActive && !isBlinking

  return (
    <div
      ref={containerRef}
      className="relative cursor-pointer select-none rounded-full"
      style={{
        width: IMG_WIDTH + 20,
        height: IMG_HEIGHT + 20,
        background: 'rgba(0, 0, 0, 0.05)',
        touchAction: 'none', // required for pointer capture
      }}
      onPointerDown={handlePointerDown}
    >
      <style>{KEYFRAMES}</style>

      {/* Character image with animations */}
      <div
        ref={animDivRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          animation: `miru-float ${expr.breathSpeed}s ease-in-out infinite`
            + (expr.bounce > 0 ? `, miru-bounce ${expr.breathSpeed * 0.5}s ease-in-out infinite` : '')
            + (isIdle ? ', miru-fidget 8s ease-in-out infinite' : ''),
        }}
      >
        {/* Main character image */}
        <div className="relative">
          <img
            ref={imgRef}
            src={miruPng}
            alt="Miru"
            draggable={false}
            style={{
              width: IMG_WIDTH,
              height: IMG_HEIGHT,
              objectFit: 'contain',
              transform: `scale(${expr.scale}) rotate(${expr.tilt}deg)`,
              filter: `brightness(${expr.brightness}) drop-shadow(${glowShadow})`,
              transition: 'transform 0.6s ease, filter 0.6s ease',
              imageRendering: 'auto',
            }}
          />

          {/* Pupil overlays */}
          {showPupils && (
            <>
              <div
                ref={leftPupilRef}
                style={{
                  position: 'absolute',
                  left: LEFT_EYE.x - PUPIL_SIZE / 2,
                  top: LEFT_EYE.y - PUPIL_SIZE / 2,
                  width: PUPIL_SIZE,
                  height: PUPIL_SIZE,
                  borderRadius: '50%',
                  background: 'rgba(60, 20, 40, 0.25)',
                  pointerEvents: 'none',
                  transition: 'opacity 0.1s',
                }}
              />
              <div
                ref={rightPupilRef}
                style={{
                  position: 'absolute',
                  left: RIGHT_EYE.x - PUPIL_SIZE / 2,
                  top: RIGHT_EYE.y - PUPIL_SIZE / 2,
                  width: PUPIL_SIZE,
                  height: PUPIL_SIZE,
                  borderRadius: '50%',
                  background: 'rgba(60, 20, 40, 0.25)',
                  pointerEvents: 'none',
                  transition: 'opacity 0.1s',
                }}
              />
            </>
          )}

          {/* Blink overlays */}
          {isBlinking && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: LEFT_EYE.x - 5,
                  top: LEFT_EYE.y - 3,
                  width: 10,
                  height: 6,
                  borderRadius: '50%',
                  background: 'rgba(220, 210, 210, 0.7)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: RIGHT_EYE.x - 5,
                  top: RIGHT_EYE.y - 3,
                  width: 10,
                  height: 6,
                  borderRadius: '50%',
                  background: 'rgba(220, 210, 210, 0.7)',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const KEYFRAMES = `
@keyframes miru-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes miru-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes miru-fidget {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-1px) rotate(-0.5deg); }
  50% { transform: translateY(1px) rotate(0.3deg); }
  75% { transform: translateY(-0.5px) rotate(-0.2deg); }
}
`
