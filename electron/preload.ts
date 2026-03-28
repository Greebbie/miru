import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window
  setIgnoreCursorEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.invoke('set-ignore-cursor-events', ignore, options),
  setWindowPosition: (x: number, y: number) =>
    ipcRenderer.invoke('set-window-position', x, y),
  getCursorPosition: () =>
    ipcRenderer.invoke('get-cursor-position') as Promise<{ x: number; y: number }>,
  getWindowPosition: () =>
    ipcRenderer.invoke('get-window-position') as Promise<{ x: number; y: number }>,
  getWindowSize: () =>
    ipcRenderer.invoke('get-window-size') as Promise<{ width: number; height: number }>,

  // Tools: Files
  listFiles: (dirPath: string) =>
    ipcRenderer.invoke('list-files', dirPath),
  readFile: (filePath: string) =>
    ipcRenderer.invoke('read-file', filePath),
  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke('create-directory', dirPath),
  moveFiles: (from: string, to: string) =>
    ipcRenderer.invoke('move-files', from, to),
  deleteFiles: (filePath: string) =>
    ipcRenderer.invoke('delete-files', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  copyFiles: (from: string, to: string) =>
    ipcRenderer.invoke('copy-files', from, to),
  searchFiles: (dirPath: string, pattern: string) =>
    ipcRenderer.invoke('search-files', dirPath, pattern),

  // Tools: Apps & Shell
  openApp: (name: string) =>
    ipcRenderer.invoke('open-app', name),
  runShell: (command: string) =>
    ipcRenderer.invoke('run-shell', command),

  // Tools: Clipboard
  clipboardRead: () =>
    ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text: string) =>
    ipcRenderer.invoke('clipboard-write', text),

  // Tools: System
  getSystemInfo: () =>
    ipcRenderer.invoke('get-system-info'),

  // Tools: Screen & Process
  getActiveWindow: () =>
    ipcRenderer.invoke('get-active-window') as Promise<{ app: string; title: string }>,
  getProcessList: () =>
    ipcRenderer.invoke('get-process-list') as Promise<{ name: string; title: string; pid: number }[]>,
  captureScreenshot: () =>
    ipcRenderer.invoke('capture-screenshot') as Promise<string>,

  // Window resize
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.invoke('set-window-size', width, height),

  // Minimize (hide to tray)
  minimizeWindow: () =>
    ipcRenderer.invoke('minimize-window'),

  // Open URL in default browser
  openUrl: (url: string) =>
    ipcRenderer.invoke('open-url', url) as Promise<void>,

  // Web search (legacy API-based, may not work in all regions)
  webSearch: (query: string) =>
    ipcRenderer.invoke('web-search', query) as Promise<{ abstract: string; results: { title: string; snippet: string; url: string }[] }>,

  // IPC event listeners
  onToggleCommandPalette: (callback: () => void) => {
    ipcRenderer.on('toggle-command-palette', () => callback())
  },
  onToggleVoice: (callback: () => void) => {
    ipcRenderer.on('toggle-voice', () => callback())
  },
  offToggleVoice: () => {
    ipcRenderer.removeAllListeners('toggle-voice')
  },

  // Special paths
  getHomeDir: () =>
    ipcRenderer.invoke('get-home-dir') as Promise<string>,

  // Vision: window list & capture
  getWindowList: () =>
    ipcRenderer.invoke('get-window-list') as Promise<{ id: string; name: string }[]>,
  captureWindow: (windowName: string, options?: { width?: number; height?: number }) =>
    ipcRenderer.invoke('capture-window', windowName, options) as Promise<string>,

  // Skill Marketplace
  skillGetDir: () =>
    ipcRenderer.invoke('skill-get-dir') as Promise<string>,
  skillScanLocal: () =>
    ipcRenderer.invoke('skill-scan-local') as Promise<{ id: string; skillMdContent: string; files: string[] }[]>,
  skillInstall: (opts: { repoUrl: string; skillId: string; files: string[] }) =>
    ipcRenderer.invoke('skill-install', opts) as Promise<{ success: boolean; skillDir: string }>,
  skillUninstall: (skillId: string) =>
    ipcRenderer.invoke('skill-uninstall', skillId) as Promise<void>,
  skillExecScript: (opts: { skillDir: string; interpreter: string; params: Record<string, string> }) =>
    ipcRenderer.invoke('skill-exec-script', opts) as Promise<{ stdout: string; stderr: string; exitCode: number }>,

  // STT (Whisper)
  sttInit: (modelId?: string) =>
    ipcRenderer.invoke('stt-init', modelId) as Promise<{ success: boolean; error?: string }>,
  sttTranscribe: (audioData: Float32Array, language?: string) =>
    ipcRenderer.invoke('stt-transcribe', audioData, language) as Promise<{ text: string; error?: string }>,
  sttStatus: () =>
    ipcRenderer.invoke('stt-status') as Promise<{ initialized: boolean }>,
  sttSwitchModel: (modelId: string) =>
    ipcRenderer.invoke('stt-switch-model', modelId) as Promise<{ success: boolean; error?: string }>,
  onSttProgress: (callback: (progress: { status: string; progress?: number; file?: string }) => void) => {
    ipcRenderer.on('stt-progress', (_event, progress) => callback(progress))
  },
  offSttProgress: () => {
    ipcRenderer.removeAllListeners('stt-progress')
  },

  // Proxy fetch (bypass CORS for AI providers)
  proxyFetch: (url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke('proxy-fetch', url, options) as Promise<{ status: number; body: string }>,
  proxyStream: (url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke('proxy-stream', url, options) as Promise<{ streamId: string } | { error: string }>,
  proxyStreamAbort: (streamId: string) =>
    ipcRenderer.invoke('proxy-stream-abort', streamId),
  onProxyStreamData: (callback: (streamId: string, data: string) => void) => {
    const handler = (_: unknown, id: string, data: string) => callback(id, data)
    ipcRenderer.on('proxy-stream-data', handler)
    return () => { ipcRenderer.off('proxy-stream-data', handler) }
  },
  onProxyStreamEnd: (callback: (streamId: string) => void) => {
    const handler = (_: unknown, id: string) => callback(id)
    ipcRenderer.on('proxy-stream-end', handler)
    return () => { ipcRenderer.off('proxy-stream-end', handler) }
  },
  onProxyStreamError: (callback: (streamId: string, error: string) => void) => {
    const handler = (_: unknown, id: string, error: string) => callback(id, error)
    ipcRenderer.on('proxy-stream-error', handler)
    return () => { ipcRenderer.off('proxy-stream-error', handler) }
  },

  // Persistent store
  storeGet: (key: string) =>
    ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) =>
    ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) =>
    ipcRenderer.invoke('store-delete', key),

  // Monitor
  monitorStart: (intervalMs?: number) =>
    ipcRenderer.invoke('monitor-start', intervalMs),
  monitorStop: () =>
    ipcRenderer.invoke('monitor-stop'),
  onWindowChanged: (callback: (data: { app: string; title: string }) => void) => {
    ipcRenderer.on('window-changed', (_event, data) => callback(data))
  },
  offWindowChanged: () => {
    ipcRenderer.removeAllListeners('window-changed')
  },

  // Automation
  sendKeys: (keys: string) =>
    ipcRenderer.invoke('send-keys', keys) as Promise<void>,
  focusWindow: (processName: string) =>
    ipcRenderer.invoke('focus-window', processName) as Promise<void>,

  // OCR
  ocrImage: (base64: string) =>
    ipcRenderer.invoke('ocr-image', base64) as Promise<string>,

  // Native notifications
  nativeNotify: (title: string, body: string) =>
    ipcRenderer.invoke('native-notify', title, body) as Promise<void>,

  // Memory DB
  memoryUpsertIdentity: (key: string, value: string) =>
    ipcRenderer.invoke('memory-upsert-identity', key, value),
  memoryGetIdentity: () =>
    ipcRenderer.invoke('memory-get-identity') as Promise<Record<string, string>>,
  memoryUpsertPreference: (key: string, value: string) =>
    ipcRenderer.invoke('memory-upsert-preference', key, value),
  memoryGetPreferences: () =>
    ipcRenderer.invoke('memory-get-preferences') as Promise<Record<string, string>>,
  memoryAddEpisode: (episode: { summary: string; userIntent?: string; toolsUsed?: string; outcome?: string }) =>
    ipcRenderer.invoke('memory-add-episode', episode),
  memoryGetEpisodes: (limit?: number) =>
    ipcRenderer.invoke('memory-get-episodes', limit),
  memoryAddFact: (fact: { category: string; content: string; confidence?: number; sourceEpisodeId?: number }) =>
    ipcRenderer.invoke('memory-add-fact', fact),
  memorySearchFacts: (query: string, limit?: number) =>
    ipcRenderer.invoke('memory-search-facts', query, limit),
  memoryGetRecentFacts: (limit?: number) =>
    ipcRenderer.invoke('memory-get-recent-facts', limit),
  memoryAddAudit: (entry: { timestamp: number; toolName: string; params?: string; resultSuccess: boolean; resultSummary: string; durationMs: number }) =>
    ipcRenderer.invoke('memory-add-audit', entry),
  memoryGetAudit: (filter?: { toolName?: string; success?: boolean; limit?: number }) =>
    ipcRenderer.invoke('memory-get-audit', filter),
  memoryClearAudit: () =>
    ipcRenderer.invoke('memory-clear-audit'),
  memoryMigrateFromJson: (data: unknown) =>
    ipcRenderer.invoke('memory-migrate-from-json', data),
})
