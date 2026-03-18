import { vi } from 'vitest'

export function createMockElectronAPI(overrides?: Partial<Record<string, any>>) {
  const api = {
    // Window
    setIgnoreCursorEvents: vi.fn().mockResolvedValue(undefined),
    setWindowPosition: vi.fn().mockResolvedValue(undefined),
    getCursorPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    getWindowPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    getWindowSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    setWindowSize: vi.fn().mockResolvedValue(undefined),
    minimizeWindow: vi.fn().mockResolvedValue(undefined),

    // Files
    listFiles: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    moveFiles: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    copyFiles: vi.fn().mockResolvedValue(undefined),
    deleteFiles: vi.fn().mockResolvedValue(undefined),
    searchFiles: vi.fn().mockResolvedValue([]),

    // Apps & Shell
    openApp: vi.fn().mockResolvedValue(undefined),
    runShell: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    openUrl: vi.fn().mockResolvedValue(undefined),

    // Clipboard
    clipboardRead: vi.fn().mockResolvedValue(''),
    clipboardWrite: vi.fn().mockResolvedValue(undefined),

    // System
    getSystemInfo: vi.fn().mockResolvedValue({
      platform: 'win32',
      hostname: 'test-pc',
      cpus: 8,
      totalMem: '16 GB',
      freeMem: '8 GB',
      uptime: '1:00:00',
      battery: null,
      network: { connected: true, ip: '192.168.1.1', type: 'wifi' },
      disks: [{ name: 'C:', usedGB: 100, freeGB: 400 }],
    }),
    getHomeDir: vi.fn().mockResolvedValue('C:\\Users\\test'),

    // Screen & Process
    getActiveWindow: vi.fn().mockResolvedValue({ app: 'Code', title: 'test.ts' }),
    getProcessList: vi.fn().mockResolvedValue([
      { name: 'Code', title: 'test.ts', pid: 1234 },
      { name: 'Chrome', title: 'Google', pid: 5678 },
    ]),
    captureScreenshot: vi.fn().mockResolvedValue('data:image/jpeg;base64,/9j/mock'),

    // Web Search
    webSearch: vi.fn().mockResolvedValue({
      abstract: 'Test result',
      results: [{ title: 'Result', snippet: 'Test', url: 'https://example.com' }],
    }),

    // Vision
    getWindowList: vi.fn().mockResolvedValue([
      { id: '1', name: 'Code' },
      { id: '2', name: 'Chrome' },
    ]),
    captureWindow: vi.fn().mockResolvedValue('data:image/jpeg;base64,/9j/window-mock'),

    // Skills
    skillGetDir: vi.fn().mockResolvedValue('C:\\Users\\test\\.miru\\skills'),
    skillScanLocal: vi.fn().mockResolvedValue([]),
    skillInstall: vi.fn().mockResolvedValue({ success: true, skillDir: '' }),
    skillUninstall: vi.fn().mockResolvedValue(undefined),
    skillExecScript: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),

    // STT
    sttInit: vi.fn().mockResolvedValue({ success: true }),
    sttTranscribe: vi.fn().mockResolvedValue({ text: 'hello world' }),
    sttStatus: vi.fn().mockResolvedValue({ initialized: false }),
    sttSwitchModel: vi.fn().mockResolvedValue({ success: true }),
    onSttProgress: vi.fn(),
    offSttProgress: vi.fn(),

    // IPC listeners
    onToggleCommandPalette: vi.fn(),
    onToggleVoice: vi.fn(),
    offToggleVoice: vi.fn(),

    // Proxy
    proxyFetch: vi.fn().mockResolvedValue({ status: 200, body: '{}' }),
    proxyStream: vi.fn().mockResolvedValue({ streamId: 'test-stream' }),
    proxyStreamAbort: vi.fn().mockResolvedValue(undefined),
    onProxyStreamData: vi.fn(() => vi.fn()),
    onProxyStreamEnd: vi.fn(() => vi.fn()),
    onProxyStreamError: vi.fn(() => vi.fn()),

    // Store
    storeGet: vi.fn().mockResolvedValue(null),
    storeSet: vi.fn().mockResolvedValue(undefined),
    storeDelete: vi.fn().mockResolvedValue(undefined),

    // Monitor
    monitorStart: vi.fn().mockResolvedValue(undefined),
    monitorStop: vi.fn().mockResolvedValue(undefined),
    onWindowChanged: vi.fn(),
    offWindowChanged: vi.fn(),

    // Automation
    sendKeys: vi.fn().mockResolvedValue(undefined),
    focusWindow: vi.fn().mockResolvedValue(undefined),

    // Memory DB
    memoryUpsertIdentity: vi.fn().mockResolvedValue(undefined),
    memoryGetIdentity: vi.fn().mockResolvedValue({}),
    memoryUpsertPreference: vi.fn().mockResolvedValue(undefined),
    memoryGetPreferences: vi.fn().mockResolvedValue({}),
    memoryAddEpisode: vi.fn().mockResolvedValue(undefined),
    memoryGetEpisodes: vi.fn().mockResolvedValue([]),
    memoryAddFact: vi.fn().mockResolvedValue(undefined),
    memorySearchFacts: vi.fn().mockResolvedValue([]),
    memoryGetRecentFacts: vi.fn().mockResolvedValue([]),
    memoryAddAudit: vi.fn().mockResolvedValue(undefined),
    memoryGetAudit: vi.fn().mockResolvedValue([]),
    memoryClearAudit: vi.fn().mockResolvedValue(undefined),
    memoryMigrateFromJson: vi.fn().mockResolvedValue(undefined),

    ...overrides,
  }
  return api
}

export function createMockSTTResult(overrides?: Partial<{ text: string; error?: string }>) {
  return {
    text: 'test',
    ...overrides,
  }
}
