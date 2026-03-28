/**
 * Centralized constants — no magic numbers scattered across files.
 */

// --- Vision Monitoring ---
/** Minimum polling interval for vision monitoring (ms). Floor to prevent excessive API calls. */
export const VISION_POLL_MIN_MS = 60_000 // 1 minute

/** Default polling interval for vision content_change detection (ms). */
export const VISION_POLL_DEFAULT_MS = 300_000 // 5 minutes

/** LLM vision call timeout (ms). Prevents polling from stalling. */
export const VISION_LLM_TIMEOUT_MS = 15_000

// --- Chat Persistence ---
/** Debounce delay for persisting chat messages to disk (ms). */
export const CHAT_PERSIST_DEBOUNCE_MS = 500

/** Maximum number of messages persisted to disk. */
export const MAX_PERSISTED_MESSAGES = 50

// --- Config Persistence ---
/** Debounce delay for persisting config changes to disk (ms). */
export const CONFIG_PERSIST_DEBOUNCE_MS = 300

// --- Character Emotions ---
/** Interval for emotion decay tick (ms). */
export const EMOTION_DECAY_INTERVAL_MS = 500

/** Exponential decay factor per tick (0.95 = 5% reduction per tick). */
export const EMOTION_DECAY_FACTOR = 0.95

/** Minutes of idle time before character yawns. */
export const IDLE_YAWN_MINUTES = 4

/** Minutes of idle time before character sleeps. */
export const IDLE_SLEEP_MINUTES = 5

// --- AI Tool Loop ---
/** Maximum rounds of tool calling before breaking the loop. */
export const MAX_TOOL_ROUNDS = 5

// --- Admin / Audit ---
/** Maximum entries in audit log. */
export const MAX_AUDIT_LOG = 500

/** Maximum entries in delegation log. */
export const MAX_DELEGATION_LOG = 200

// --- Token Budget ---
/** Token limits per budget mode. */
export const TOKEN_BUDGETS = {
  minimal: 3000,
  balanced: 4000,
  smart: 6000,
} as const

// --- Vision Preset Intervals ---
/** Pre-configured polling intervals for watch presets (ms). */
export const PRESET_INTERVALS = {
  claudeCode: 120_000, // 2 minutes
  webWatch: 300_000,    // 5 minutes
  buildWatch: 60_000,   // 1 minute
} as const
