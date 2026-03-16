import { app, BrowserWindow, ipcMain, screen, clipboard, globalShortcut, Tray, Menu, nativeImage, desktopCapturer } from 'electron'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'
import { exec } from 'child_process'
import { initVision, analyzeScreen, isVisionInitialized } from './vision'
import { setupMonitor } from './monitor'
import { setupAutomation } from './automation'
import { setupMemoryDb } from './memory-db'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Simple JSON file store (avoids ESM-only electron-store issues)
class JsonStore {
  private filePath: string
  private data: Record<string, unknown> = {}

  constructor(name = 'miru-store') {
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, `${name}.json`)
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch { /* start fresh */ }
  }

  get(key: string): unknown {
    return this.data[key]
  }

  set(key: string, value: unknown): void {
    this.data[key] = value
    this.save()
  }

  delete(key: string): void {
    delete this.data[key]
    this.save()
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch { /* ignore write errors */ }
  }
}

let store: JsonStore

function createWindow() {
  const iconPath = path.join(__dirname, '../src/assets/miru.png')
  const iconImage = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    title: 'Miru',
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Force taskbar icon refresh
  mainWindow.setSkipTaskbar(false)

  // Position at bottom-right corner (match window height exactly)
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  mainWindow.setPosition(screenW - 420, screenH - 700)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // DevTools: Ctrl+Shift+I to open manually if needed
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---- Window IPC ----

ipcMain.handle('set-ignore-cursor-events', (_event, ignore: boolean, options?: { forward: boolean }) => {
  mainWindow?.setIgnoreMouseEvents(ignore, options || { forward: true })
})

ipcMain.handle('set-window-position', (_event, x: number, y: number) => {
  mainWindow?.setPosition(Math.round(x), Math.round(y))
})

ipcMain.handle('get-cursor-position', () => {
  const point = screen.getCursorScreenPoint()
  return { x: point.x, y: point.y }
})

ipcMain.handle('get-window-position', () => {
  const pos = mainWindow?.getPosition()
  return pos ? { x: pos[0], y: pos[1] } : { x: 0, y: 0 }
})

ipcMain.handle('get-window-size', () => {
  const size = mainWindow?.getSize()
  return size ? { width: size[0], height: size[1] } : { width: 400, height: 600 }
})

ipcMain.handle('set-window-size', (_event, width: number, height: number) => {
  mainWindow?.setSize(Math.round(width), Math.round(height))
})

ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize()
})

// ---- Tool IPC: Files ----

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

ipcMain.handle('list-files', (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(normalizePath(dirPath), { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
  } catch (err) {
    throw new Error(`Cannot list files in "${dirPath}": ${(err as Error).message}`)
  }
})

ipcMain.handle('read-file', (_event, filePath: string) => {
  try {
    return fs.readFileSync(normalizePath(filePath), 'utf-8')
  } catch (err) {
    throw new Error(`Cannot read "${filePath}": ${(err as Error).message}`)
  }
})

ipcMain.handle('create-directory', (_event, dirPath: string) => {
  try {
    fs.mkdirSync(normalizePath(dirPath), { recursive: true })
  } catch (err) {
    throw new Error(`Cannot create directory "${dirPath}": ${(err as Error).message}`)
  }
})

ipcMain.handle('move-files', (_event, from: string, to: string) => {
  try {
    fs.renameSync(normalizePath(from), normalizePath(to))
  } catch (err) {
    throw new Error(`Cannot move "${from}" to "${to}": ${(err as Error).message}`)
  }
})

ipcMain.handle('delete-files', (_event, filePath: string) => {
  try {
    const p = normalizePath(filePath)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true })
    } else {
      fs.unlinkSync(p)
    }
  } catch (err) {
    throw new Error(`Cannot delete "${filePath}": ${(err as Error).message}`)
  }
})

ipcMain.handle('write-file', (_event, filePath: string, content: string) => {
  try {
    const p = normalizePath(filePath)
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, content, 'utf-8')
  } catch (err) {
    throw new Error(`Cannot write "${filePath}": ${(err as Error).message}`)
  }
})

ipcMain.handle('copy-files', (_event, from: string, to: string) => {
  try {
    const src = normalizePath(from)
    const dest = normalizePath(to)
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true })
    } else {
      const destDir = path.dirname(dest)
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(src, dest)
    }
  } catch (err) {
    throw new Error(`Cannot copy "${from}" to "${to}": ${(err as Error).message}`)
  }
})

ipcMain.handle('search-files', (_event, dirPath: string, pattern: string) => {
  try {
    const pat = pattern.toLowerCase()
    const results: string[] = []

    function walk(dir: string, depth: number) {
      if (depth > 5 || results.length > 50) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const full = path.join(dir, entry.name)
          if (entry.name.toLowerCase().includes(pat)) {
            results.push(normalizePath(full))
          }
          if (entry.isDirectory()) {
            walk(full, depth + 1)
          }
        }
      } catch { /* skip inaccessible dirs */ }
    }

    walk(normalizePath(dirPath), 0)
    return results
  } catch (err) {
    throw new Error(`Cannot search "${dirPath}": ${(err as Error).message}`)
  }
})

// ---- Tool IPC: Apps ----

ipcMain.handle('open-app', (_event, name: string) => {
  return new Promise<void>((resolve, reject) => {
    const platform = os.platform()
    let cmd: string
    if (platform === 'win32') cmd = `start "" "${name}"`
    else if (platform === 'darwin') cmd = `open -a "${name}"`
    else cmd = `xdg-open "${name}" 2>/dev/null || ${name.toLowerCase()}`

    exec(cmd, (err) => {
      if (err) reject(new Error(`Cannot open "${name}"`))
      else resolve()
    })
  })
})

// ---- Tool IPC: Shell ----

ipcMain.handle('run-shell', (_event, command: string) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(err.message))
      else resolve({ stdout: stdout.slice(0, 1000), stderr: stderr.slice(0, 500) })
    })
  })
})

// ---- Tool IPC: Clipboard ----

ipcMain.handle('clipboard-read', () => {
  return clipboard.readText()
})

ipcMain.handle('clipboard-write', (_event, text: string) => {
  clipboard.writeText(text)
})

// ---- Tool IPC: System Info ----

ipcMain.handle('get-system-info', async () => {
  const base = {
    platform: os.platform(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMem: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    freeMem: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
    uptime: `${Math.round(os.uptime() / 3600)}h`,
    battery: null as { percent: number; charging: boolean } | null,
    network: { connected: false, ip: '', type: 'unknown' },
    disks: [] as { name: string; usedGB: number; freeGB: number }[],
  }

  // Battery (Windows)
  if (os.platform() === 'win32') {
    try {
      const batteryOut = await new Promise<string>((resolve, reject) => {
        exec('powershell -command "(Get-WmiObject Win32_Battery | Select EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json)"', { timeout: 5000 }, (err, stdout) => {
          if (err) reject(err); else resolve(stdout.trim())
        })
      })
      if (batteryOut) {
        const bat = JSON.parse(batteryOut)
        base.battery = { percent: bat.EstimatedChargeRemaining || 0, charging: bat.BatteryStatus === 2 }
      }
    } catch { /* no battery or error */ }
  }

  // Network
  const nets = os.networkInterfaces()
  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (!addr.internal && addr.family === 'IPv4') {
        base.network = { connected: true, ip: addr.address, type: name }
        break
      }
    }
    if (base.network.connected) break
  }

  // Disks (Windows)
  if (os.platform() === 'win32') {
    try {
      const diskOut = await new Promise<string>((resolve, reject) => {
        exec('powershell -command "Get-PSDrive -PSProvider FileSystem | Select Name,@{N=\'UsedGB\';E={[math]::Round($_.Used/1GB)}},@{N=\'FreeGB\';E={[math]::Round($_.Free/1GB)}} | ConvertTo-Json"', { timeout: 5000 }, (err, stdout) => {
          if (err) reject(err); else resolve(stdout.trim())
        })
      })
      if (diskOut) {
        const parsed = JSON.parse(diskOut)
        base.disks = (Array.isArray(parsed) ? parsed : [parsed])
          .filter((d: { Name: string; UsedGB: number; FreeGB: number }) => d.FreeGB > 0 || d.UsedGB > 0)
          .map((d: { Name: string; UsedGB: number; FreeGB: number }) => ({ name: d.Name, usedGB: d.UsedGB, freeGB: d.FreeGB }))
      }
    } catch { /* ignore */ }
  }

  return base
})

// ---- Tool IPC: Active Window ----

ipcMain.handle('get-active-window', () => {
  return new Promise<{ app: string; title: string }>((resolve, reject) => {
    if (os.platform() === 'win32') {
      exec(
        'powershell -command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type @\\"\\nusing System;using System.Runtime.InteropServices;\\npublic class Win32{[DllImport(\\"user32.dll\\")]public static extern IntPtr GetForegroundWindow();}\\n\\"@; $h=[Win32]::GetForegroundWindow(); $p=Get-Process | Where-Object {$_.MainWindowHandle -eq $h} | Select -First 1; Write-Output \\"$($p.ProcessName)|$($p.MainWindowTitle)\\""',
        { timeout: 5000 },
        (err, stdout) => {
          if (err) return reject(new Error('Cannot get active window'))
          const parts = stdout.trim().split('|')
          resolve({ app: parts[0] || 'unknown', title: parts.slice(1).join('|') || '' })
        }
      )
    } else if (os.platform() === 'darwin') {
      exec(
        'osascript -e \'tell application "System Events" to get {name, title} of first application process whose frontmost is true\'',
        { timeout: 5000 },
        (err, stdout) => {
          if (err) return reject(new Error('Cannot get active window'))
          const parts = stdout.trim().split(', ')
          resolve({ app: parts[0] || 'unknown', title: parts[1] || '' })
        }
      )
    } else {
      exec('xdotool getactivewindow getwindowname', { timeout: 5000 }, (err, stdout) => {
        if (err) return resolve({ app: 'unknown', title: '' })
        resolve({ app: 'unknown', title: stdout.trim() })
      })
    }
  })
})

// ---- Tool IPC: Process List ----

ipcMain.handle('get-process-list', () => {
  return new Promise<{ name: string; title: string; pid: number }[]>((resolve, reject) => {
    if (os.platform() === 'win32') {
      exec(
        'powershell -command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Process | Where-Object {$_.MainWindowTitle} | Select ProcessName,MainWindowTitle,Id | ConvertTo-Json"',
        { timeout: 10000 },
        (err, stdout) => {
          if (err) return reject(new Error('Cannot list processes'))
          try {
            const parsed = JSON.parse(stdout.trim())
            const list = (Array.isArray(parsed) ? parsed : [parsed])
              .slice(0, 30)
              .map((p: { ProcessName: string; MainWindowTitle: string; Id: number }) => ({
                name: p.ProcessName,
                title: p.MainWindowTitle,
                pid: p.Id,
              }))
            resolve(list)
          } catch {
            resolve([])
          }
        }
      )
    } else {
      exec('ps aux | head -31', { timeout: 5000 }, (err, stdout) => {
        if (err) return resolve([])
        const lines = stdout.trim().split('\n').slice(1, 31)
        resolve(lines.map((l) => {
          const parts = l.trim().split(/\s+/)
          return { name: parts[10] || '', title: '', pid: parseInt(parts[1]) || 0 }
        }))
      })
    }
  })
})

// ---- Tool IPC: Screenshot ----

ipcMain.handle('capture-screenshot', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 640, height: 360 },
  })
  if (sources.length === 0) throw new Error('No screen source available')
  const thumbnail = sources[0].thumbnail
  const dataUrl = thumbnail.toJPEG(60).toString('base64')
  return `data:image/jpeg;base64,${dataUrl}`
})

// ---- Special Paths ----

ipcMain.handle('get-home-dir', () => os.homedir().replace(/\\/g, '/'))

// ---- Tool IPC: Web Search ----

ipcMain.handle('web-search', (_event, query: string) => {
  return new Promise<{ abstract: string; results: { title: string; snippet: string; url: string }[] }>((resolve, reject) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const results: { title: string; snippet: string; url: string }[] = []
          if (json.RelatedTopics) {
            for (const topic of json.RelatedTopics.slice(0, 5)) {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0]?.slice(0, 80) || '',
                  snippet: topic.Text.slice(0, 200),
                  url: topic.FirstURL,
                })
              }
            }
          }
          resolve({
            abstract: json.AbstractText || '',
            results,
          })
        } catch {
          reject(new Error('Failed to parse search results'))
        }
      })
    })
    req.on('error', () => reject(new Error('Search request failed')))
    req.on('timeout', () => { req.destroy(); reject(new Error('Search timeout')) })
  })
})

// ---- Vision IPC ----

ipcMain.handle('vision-init', async () => {
  try {
    const modelDir = path.join(app.getPath('userData'), 'models')
    await initVision(modelDir)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('vision-analyze', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 640, height: 360 },
    })
    if (sources.length === 0) throw new Error('No screen source available')
    const jpegBuffer = sources[0].thumbnail.toJPEG(80)
    const result = await analyzeScreen(Buffer.from(jpegBuffer))
    return result
  } catch (err) {
    return { detections: [], ocrText: '', summary: `Vision error: ${(err as Error).message}` }
  }
})

ipcMain.handle('vision-status', () => {
  return { initialized: isVisionInitialized() }
})

// ---- Persistent Store IPC ----

ipcMain.handle('store-get', (_event, key: string) => {
  return store.get(key)
})

ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
  store.set(key, value)
})

ipcMain.handle('store-delete', (_event, key: string) => {
  store.delete(key)
})

function createTray() {
  // 16x16 blue circle icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4T2NkYPj/n4EBCBgZGRkYQWwUwAgyAcYGsUEmMDAyMDKiGIJsCLIJyIagGILNBSBD0F2A4gIMA3C5AG4AslcBAACX6B0RqiMtGAAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setToolTip('Miru')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 Miru',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    {
      label: '命令面板',
      accelerator: 'CommandOrControl+Space',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
        mainWindow?.webContents.send('toggle-command-palette')
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

app.commandLine.appendSwitch('remote-debugging-port', '9222')

app.whenReady().then(() => {
  store = new JsonStore()
  createWindow()
  createTray()

  // Setup monitor and automation
  setupMonitor(() => mainWindow)
  setupAutomation()

  // Setup memory DB (may fail if better-sqlite3 native module not rebuilt for Electron)
  if (setupMemoryDb) {
    try {
      const dbPath = path.join(app.getPath('userData'), 'miru-memory.db')
      setupMemoryDb(dbPath)
    } catch (err) {
      console.error('[Miru] Memory DB init failed (better-sqlite3 may need rebuild):', (err as Error).message)
      console.error('[Miru] Run: npx electron-rebuild -f -w better-sqlite3')
    }
  }

  // Global shortcuts
  globalShortcut.register('CommandOrControl+Space', () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('toggle-command-palette')
  })

  globalShortcut.register('Alt+M', () => {
    mainWindow?.webContents.send('toggle-voice')
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
