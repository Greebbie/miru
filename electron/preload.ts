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

  // Web search
  webSearch: (query: string) =>
    ipcRenderer.invoke('web-search', query) as Promise<{ abstract: string; results: { title: string; snippet: string; url: string }[] }>,

  // IPC event listeners
  onToggleCommandPalette: (callback: () => void) => {
    ipcRenderer.on('toggle-command-palette', () => callback())
  },
  onToggleVoice: (callback: () => void) => {
    ipcRenderer.on('toggle-voice', () => callback())
  },

  // Special paths
  getHomeDir: () =>
    ipcRenderer.invoke('get-home-dir') as Promise<string>,

  // Vision
  visionInit: () =>
    ipcRenderer.invoke('vision-init') as Promise<{ success: boolean }>,
  visionAnalyze: () =>
    ipcRenderer.invoke('vision-analyze') as Promise<{
      detections: { label: string; confidence: number; bbox: [number, number, number, number] }[]
      ocrText: string
      summary: string
    }>,
  visionStatus: () =>
    ipcRenderer.invoke('vision-status') as Promise<{ initialized: boolean }>,

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
