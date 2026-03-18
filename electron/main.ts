import { app, BrowserWindow, ipcMain, screen, clipboard, globalShortcut, Tray, Menu, nativeImage, desktopCapturer, shell, net } from 'electron'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'
import { exec, execFile } from 'child_process'
import { initVision, analyzeScreen, isVisionInitialized } from './vision'
import { initSTT, transcribeAudio, isSTTInitialized, destroySTT } from './stt'
import { setupMonitor } from './monitor'
import { setupAutomation } from './automation'
import { setupMemoryDb } from './memory-db'

// main.js is loaded as ESM (package.json "type": "module"), so define __filename/__dirname
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
  const iconCandidates = [
    path.join(__dirname, '../src/assets/miru.png'),     // dev
    path.join(__dirname, '../dist/miru.png'),            // built
    path.join(process.resourcesPath || '', 'miru.png'),  // packaged
  ]
  const iconPath = iconCandidates.find((p) => fs.existsSync(p))
  const iconImage = iconPath ? nativeImage.createFromPath(iconPath) : undefined

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
      webSecurity: true,
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

  // Handle CORS for AI API calls (replaces webSecurity:false)
  const ses = mainWindow.webContents.session
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    delete headers['Origin']
    callback({ requestHeaders: headers })
  })
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'access-control-allow-origin': ['*'],
        'access-control-allow-headers': ['*'],
        'access-control-allow-methods': ['*'],
      },
    })
  })

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
    const cb = (err: Error | null) => {
      if (err) reject(new Error(`Cannot open "${name}"`))
      else resolve()
    }

    if (platform === 'win32') {
      execFile('cmd', ['/c', 'start', '', name], cb)
    } else if (platform === 'darwin') {
      execFile('open', ['-a', name], cb)
    } else {
      execFile('xdg-open', [name], cb)
    }
  })
})

// ---- Tool IPC: Open URL ----

ipcMain.handle('open-url', async (_event, url: string) => {
  await shell.openExternal(url)
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

// Bing search scraper — works in China, no API key needed
function fetchWithRedirects(targetUrl: string, headers: Record<string, string>, maxRedirects = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    function doRequest(currentUrl: string, remaining: number) {
      const parsedUrl = new URL(currentUrl)
      const mod = parsedUrl.protocol === 'https:' ? https : https
      const req = mod.get(currentUrl, { headers, timeout: 10000 }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && remaining > 0) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsedUrl.protocol}//${parsedUrl.host}${res.headers.location}`
          res.resume()
          doRequest(next, remaining - 1)
          return
        }
        let data = ''
        res.on('data', (chunk: string) => { data += chunk })
        res.on('end', () => resolve(data))
      })
      req.on('error', (err) => reject(err))
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    }
    doRequest(targetUrl, maxRedirects)
  })
}

function parseBingResults(html: string): { title: string; snippet: string; url: string }[] {
  const results: { title: string; snippet: string; url: string }[] = []
  // Match Bing search result blocks: <li class="b_algo">
  const blockRegex = /<li class="b_algo">([\s\S]*?)<\/li>/g
  let match
  while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
    const block = match[1]
    // Extract URL and title from <h2><a href="...">...</a></h2>
    const titleMatch = /<h2>\s*<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(block)
    if (!titleMatch) continue
    const url = titleMatch[1]
    const title = titleMatch[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#?\w+;/g, '').trim()
    // Extract snippet from <p> or <div class="b_caption"><p>
    const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block)
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#?\w+;/g, '').trim()
      : ''
    if (title && url) {
      results.push({ title: title.slice(0, 100), snippet: snippet.slice(0, 300), url })
    }
  }
  return results
}

ipcMain.handle('web-search', async (_event, query: string) => {
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN`
    const html = await fetchWithRedirects(searchUrl, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
    })
    const results = parseBingResults(html)
    return { abstract: '', results }
  } catch (err) {
    throw new Error(`Search failed: ${(err as Error).message}`)
  }
})

// ---- Vision IPC ----

ipcMain.handle('vision-init', async () => {
  try {
    const modelDir = path.join(app.getPath('userData'), 'models')
    await initVision(modelDir, __dirname)
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

// ---- Vision IPC: Window-targeted ----

ipcMain.handle('get-window-list', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1, height: 1 },
  })
  return sources.map(s => ({ id: s.id, name: s.name })).filter(s => s.name)
})

ipcMain.handle('vision-analyze-window', async (_event, windowName: string) => {
  try {
    // Auto-init vision if needed
    if (!isVisionInitialized()) {
      const modelDir = path.join(app.getPath('userData'), 'models')
      await initVision(modelDir, __dirname)
    }

    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 640, height: 360 },
    })

    // Fuzzy match window name (case-insensitive)
    const lowerName = windowName.toLowerCase()
    let source = sources.find(s => s.name.toLowerCase().includes(lowerName))

    // Fallback to full screen if window not found — report it
    let fellBackToFullScreen = false
    if (!source) {
      const screenSources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 640, height: 360 },
      })
      source = screenSources[0]
      fellBackToFullScreen = true
    }

    if (!source) {
      return { detections: [], ocrText: '', summary: 'No source available' }
    }

    const jpegBuffer = source.thumbnail.toJPEG(80)
    const result = await analyzeScreen(Buffer.from(jpegBuffer))
    if (fellBackToFullScreen) {
      return {
        ...result,
        summary: `[Window "${windowName}" not found, used full screen] ${result.summary}`,
      }
    }
    return result
  } catch (err) {
    return { detections: [], ocrText: '', summary: `Vision error: ${(err as Error).message}` }
  }
})

// ---- STT (Whisper) IPC ----

ipcMain.handle('stt-init', async (_event, modelId?: string) => {
  try {
    const cacheDir = path.join(app.getPath('userData'), 'models', 'whisper')
    await initSTT(cacheDir, modelId || 'Xenova/whisper-tiny', (progress) => {
      mainWindow?.webContents.send('stt-progress', progress)
    }, __dirname)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('stt-transcribe', async (_event, audioData: Float32Array, language?: string) => {
  try {
    const result = await transcribeAudio(audioData, language)
    return result
  } catch (err) {
    return { text: '', error: (err as Error).message }
  }
})

ipcMain.handle('stt-status', () => {
  return { initialized: isSTTInitialized() }
})

ipcMain.handle('stt-switch-model', async (_event, modelId: string) => {
  try {
    destroySTT()
    const cacheDir = path.join(app.getPath('userData'), 'models', 'whisper')
    await initSTT(cacheDir, modelId, (progress) => {
      mainWindow?.webContents.send('stt-progress', progress)
    }, __dirname)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

// ---- Skill Marketplace IPC ----

ipcMain.handle('skill-get-dir', () => {
  const dir = path.join(os.homedir(), '.miru', 'skills')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir.replace(/\\/g, '/')
})

ipcMain.handle('skill-scan-local', () => {
  const dir = path.join(os.homedir(), '.miru', 'skills')
  if (!fs.existsSync(dir)) return []
  const results: { id: string; skillMdContent: string; files: string[] }[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillDir = path.join(dir, entry.name)
      const skillMdPath = path.join(skillDir, 'SKILL.md')
      if (!fs.existsSync(skillMdPath)) continue
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8')
      const files = fs.readdirSync(skillDir)
      results.push({ id: entry.name, skillMdContent, files })
    }
  } catch { /* ignore */ }
  return results
})

ipcMain.handle('skill-install', async (_event, { repoUrl, skillId, files }: { repoUrl: string; skillId: string; files: string[] }) => {
  // Security: validate skillId has no path traversal
  const skillsRoot = path.resolve(os.homedir(), '.miru', 'skills')
  const dir = path.resolve(skillsRoot, skillId)
  if (!dir.startsWith(skillsRoot) || skillId.includes('..')) {
    return { success: false, skillDir: '' }
  }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  for (const file of files) {
    // Security: validate each file path stays inside skill dir
    const filePath = path.resolve(dir, file)
    if (!filePath.startsWith(dir)) continue // skip traversal attempts

    const fileUrl = `${repoUrl.replace(/\/$/, '')}/${file}`
    await new Promise<void>((resolve, reject) => {
      const req = https.get(fileUrl, { timeout: 15000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          const redirectUrl = res.headers.location
          if (!redirectUrl) return reject(new Error('Redirect without location'))
          https.get(redirectUrl, { timeout: 15000 }, (res2) => {
            // Skip 404 on redirect target
            if (res2.statusCode === 404) { res2.resume(); resolve(); return }
            let data = ''
            res2.on('data', (chunk: string) => { data += chunk })
            res2.on('end', () => {
              fs.writeFileSync(filePath, data, 'utf-8')
              resolve()
            })
          }).on('error', reject)
          return
        }
        // Skip 404 — some skills don't have all script files
        if (res.statusCode === 404) { res.resume(); resolve(); return }
        let data = ''
        res.on('data', (chunk: string) => { data += chunk })
        res.on('end', () => {
          fs.writeFileSync(filePath, data, 'utf-8')
          resolve()
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')) })
    })
  }
  return { success: true, skillDir: dir.replace(/\\/g, '/') }
})

ipcMain.handle('skill-uninstall', (_event, skillId: string) => {
  // Security: validate skillId has no path traversal
  const skillsRoot = path.resolve(os.homedir(), '.miru', 'skills')
  const dir = path.resolve(skillsRoot, skillId)
  if (!dir.startsWith(skillsRoot) || skillId.includes('..')) return
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true })
  }
})

ipcMain.handle('skill-exec-script', (_event, { skillDir, interpreter, params }: { skillDir: string; interpreter: string; params: Record<string, string> }) => {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const dir = normalizePath(skillDir)

    // Security: validate skillDir is inside ~/.miru/skills/
    const skillsRoot = path.resolve(os.homedir(), '.miru', 'skills')
    const resolvedDir = path.resolve(dir)
    if (!resolvedDir.startsWith(skillsRoot)) {
      resolve({ stdout: '', stderr: 'Invalid skill directory', exitCode: 1 })
      return
    }

    // Use execFile to avoid shell injection
    let command: string
    let args: string[]
    switch (interpreter) {
      case 'node': command = 'node'; args = [path.join(resolvedDir, 'run.js')]; break
      case 'python': command = 'python'; args = [path.join(resolvedDir, 'run.py')]; break
      case 'powershell': command = 'powershell'; args = ['-ExecutionPolicy', 'Bypass', '-File', path.join(resolvedDir, 'run.ps1')]; break
      default: command = 'bash'; args = [path.join(resolvedDir, 'run.sh')]; break
    }

    // Only pass PATH + MIRU_PARAM_* (not full process.env with API keys)
    const env: Record<string, string> = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || os.homedir(),
      USERPROFILE: process.env.USERPROFILE || os.homedir(),
    }
    for (const [k, v] of Object.entries(params)) {
      env[`MIRU_PARAM_${k.toUpperCase()}`] = String(v)
    }

    execFile(command, args, { timeout: 30000, env, cwd: resolvedDir }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 500),
        exitCode: err ? 1 : 0,
      })
    })
  })
})

// ---- Proxy Fetch (bypass CORS for AI providers) ----

const activeStreams = new Map<string, AbortController>()

ipcMain.handle('proxy-fetch', async (_event, url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) => {
  console.log('[Miru] proxy-fetch →', options.method || 'POST', url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await net.fetch(url, {
      method: options.method || 'POST',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    })
    const body = await res.text()
    console.log('[Miru] proxy-fetch ←', res.status, body.slice(0, 200))
    return { status: res.status, body }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Miru] proxy-fetch error:', msg)
    throw new Error(msg)
  } finally {
    clearTimeout(timeout)
  }
})

ipcMain.handle('proxy-stream', async (event, url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const streamId = Math.random().toString(36).slice(2, 10)
  const abortController = new AbortController()

  try {
    const res = await net.fetch(url, {
      method: options.method || 'POST',
      headers: options.headers,
      body: options.body,
      signal: abortController.signal,
    })

    if (res.status >= 400) {
      const errBody = await res.text()
      if (!event.sender.isDestroyed()) {
        event.sender.send('proxy-stream-error', streamId, `API error ${res.status}: ${errBody}`)
      }
      return { streamId }
    }

    activeStreams.set(streamId, abortController)

    // Read stream in background
    const reader = res.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (!event.sender.isDestroyed()) {
              event.sender.send('proxy-stream-data', streamId, decoder.decode(value, { stream: true }))
            }
          }
          if (!event.sender.isDestroyed()) {
            event.sender.send('proxy-stream-end', streamId)
          }
        } catch (err) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('proxy-stream-error', streamId, (err as Error).message)
          }
        } finally {
          activeStreams.delete(streamId)
        }
      }
      pump()
    }

    return { streamId }
  } catch (err) {
    activeStreams.delete(streamId)
    return { error: (err as Error).message }
  }
})

ipcMain.handle('proxy-stream-abort', (_event, streamId: string) => {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
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

app.whenReady().then(async () => {
  // Inherit system proxy from env (e.g. http_proxy / https_proxy)
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY
  if (proxyUrl) {
    console.log('[Miru] Setting proxy:', proxyUrl)
    // Electron setProxy needs proxyRules in Chromium format: "http://host:port"
    // Also set proxyBypassRules for localhost
    const { session } = await import('electron')
    await session.defaultSession.setProxy({
      proxyRules: proxyUrl,
      proxyBypassRules: 'localhost,127.0.0.1',
    })
    const resolved = await session.defaultSession.resolveProxy('https://api.minimax.chat')
    console.log('[Miru] Proxy resolved for minimax:', resolved)
  }

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
