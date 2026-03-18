import type { AnimationState } from '@/stores/characterStore'

export interface ExpressionStyle {
  /** Seconds per float cycle */
  breathSpeed: number
  /** Scale multiplier */
  scale: number
  /** Rotation in degrees (tilt) */
  tilt: number
  /** Vertical bounce amplitude in px (0 = no bounce) */
  bounce: number
  /** Glow color (CSS shadow) */
  glowColor: string
  /** Glow intensity 0-1 */
  glowIntensity: number
  /** CSS brightness filter (1 = normal) */
  brightness: number
  /** Whether eyes should track mouse */
  eyesActive: boolean
}

export const expressionMap: Record<AnimationState, ExpressionStyle> = {
  idle: {
    breathSpeed: 3,
    scale: 1,
    tilt: 0,
    bounce: 0,
    glowColor: '#A8E8C8',
    glowIntensity: 0.3,
    brightness: 1,
    eyesActive: true,
  },
  curious: {
    breathSpeed: 2,
    scale: 1.05,
    tilt: -5,
    bounce: 0,
    glowColor: '#A8E8C8',
    glowIntensity: 0.5,
    brightness: 1.05,
    eyesActive: true,
  },
  focused: {
    breathSpeed: 4,
    scale: 1,
    tilt: 0,
    bounce: 0,
    glowColor: '#7EC8E3',
    glowIntensity: 0.3,
    brightness: 0.95,
    eyesActive: true,
  },
  happy: {
    breathSpeed: 1.8,
    scale: 1.05,
    tilt: 3,
    bounce: 4,
    glowColor: '#FFD700',
    glowIntensity: 0.6,
    brightness: 1.1,
    eyesActive: true,
  },
  concerned: {
    breathSpeed: 2.5,
    scale: 0.98,
    tilt: -3,
    bounce: 0,
    glowColor: '#B0C4DE',
    glowIntensity: 0.3,
    brightness: 0.9,
    eyesActive: true,
  },
  yawning: {
    breathSpeed: 5,
    scale: 0.98,
    tilt: 5,
    bounce: 0,
    glowColor: '#C8B0E8',
    glowIntensity: 0.2,
    brightness: 0.85,
    eyesActive: false,
  },
  sleepy: {
    breathSpeed: 6,
    scale: 0.96,
    tilt: 8,
    bounce: 0,
    glowColor: '#9BB0C9',
    glowIntensity: 0.15,
    brightness: 0.75,
    eyesActive: false,
  },
}
