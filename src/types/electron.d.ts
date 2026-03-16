export interface ElectronAPI {
  setIgnoreCursorEvents: (ignore: boolean, options?: { forward: boolean }) => Promise<void>
  setWindowPosition: (x: number, y: number) => Promise<void>
  getCursorPosition: () => Promise<{ x: number; y: number }>
  getWindowPosition: () => Promise<{ x: number; y: number }>
  getWindowSize: () => Promise<{ width: number; height: number }>

  // Tool IPC
  listFiles: (dirPath: string) => Promise<{ name: string; isDir: boolean }[]>
  readFile: (filePath: string) => Promise<string>
  createDirectory: (dirPath: string) => Promise<void>
  moveFiles: (from: string, to: string) => Promise<void>
  writeFile: (filePath: string, content: string) => Promise<void>
  copyFiles: (from: string, to: string) => Promise<void>
  deleteFiles: (filePath: string) => Promise<void>
  searchFiles: (dirPath: string, pattern: string) => Promise<string[]>
  openApp: (name: string) => Promise<void>
  runShell: (command: string) => Promise<{ stdout: string; stderr: string }>
  clipboardRead: () => Promise<string>
  clipboardWrite: (text: string) => Promise<void>
  getSystemInfo: () => Promise<{
    platform: string
    hostname: string
    cpus: number
    totalMem: string
    freeMem: string
    uptime: string
    battery: { percent: number; charging: boolean } | null
    network: { connected: boolean; ip: string; type: string }
    disks: { name: string; usedGB: number; freeGB: number }[]
  }>

  // Screen & Process
  getActiveWindow: () => Promise<{ app: string; title: string }>
  getProcessList: () => Promise<{ name: string; title: string; pid: number }[]>
  captureScreenshot: () => Promise<string>

  // Special paths
  getHomeDir: () => Promise<string>

  // Window resize
  setWindowSize: (width: number, height: number) => Promise<void>

  // Minimize (hide to tray)
  minimizeWindow: () => Promise<void>

  // Web search
  webSearch: (query: string) => Promise<{
    abstract: string
    results: { title: string; snippet: string; url: string }[]
  }>

  // Vision
  visionInit: () => Promise<{ success: boolean }>
  visionAnalyze: () => Promise<{
    detections: { label: string; confidence: number; bbox: [number, number, number, number] }[]
    ocrText: string
    summary: string
  }>
  visionStatus: () => Promise<{ initialized: boolean }>

  // IPC event listeners
  onToggleCommandPalette: (callback: () => void) => void
  onToggleVoice: (callback: () => void) => void

  // Persistent store IPC
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeDelete: (key: string) => Promise<void>

  // Monitor
  monitorStart: (intervalMs?: number) => Promise<void>
  monitorStop: () => Promise<void>
  onWindowChanged: (callback: (data: { app: string; title: string }) => void) => void
  offWindowChanged: () => void

  // Automation
  sendKeys: (keys: string) => Promise<void>
  focusWindow: (processName: string) => Promise<void>

  // Memory DB
  memoryUpsertIdentity: (key: string, value: string) => Promise<void>
  memoryGetIdentity: () => Promise<Record<string, string>>
  memoryUpsertPreference: (key: string, value: string) => Promise<void>
  memoryGetPreferences: () => Promise<Record<string, string>>
  memoryAddEpisode: (episode: { summary: string; userIntent?: string; toolsUsed?: string; outcome?: string }) => Promise<void>
  memoryGetEpisodes: (limit?: number) => Promise<{
    id: number; timestamp: number; summary: string; userIntent?: string; toolsUsed?: string; outcome?: string
  }[]>
  memoryAddFact: (fact: { category: string; content: string; confidence?: number; sourceEpisodeId?: number }) => Promise<void>
  memorySearchFacts: (query: string, limit?: number) => Promise<{
    id: number; category: string; content: string; confidence: number; accessCount: number
  }[]>
  memoryGetRecentFacts: (limit?: number) => Promise<{
    id: number; category: string; content: string; confidence: number; accessCount: number
  }[]>
  memoryAddAudit: (entry: { timestamp: number; toolName: string; params?: string; resultSuccess: boolean; resultSummary: string; durationMs: number }) => Promise<void>
  memoryGetAudit: (filter?: { toolName?: string; success?: boolean; limit?: number }) => Promise<{
    id: number; timestamp: number; toolName: string; params?: string; resultSuccess: boolean; resultSummary: string; durationMs: number
  }[]>
  memoryClearAudit: () => Promise<void>
  memoryMigrateFromJson: (data: unknown) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
