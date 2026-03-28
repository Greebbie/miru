/**
 * OCR module — extracts text from screenshots using Tesseract.js.
 * Used as a zero-LLM-cost fallback before sending to AI Vision.
 */

import { ipcMain, app } from 'electron'
import { join } from 'path'

let worker: import('tesseract.js').Worker | null = null
let initializing = false

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (worker) return worker
  if (initializing) {
    // Wait for initialization
    while (initializing) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (worker) return worker
  }

  initializing = true
  try {
    const Tesseract = await import('tesseract.js')

    // Look for trained data in multiple locations
    const possiblePaths = [
      join(app.getAppPath(), '..'),
      app.getAppPath(),
      join(app.getAppPath(), 'resources'),
      process.cwd(),
    ]

    worker = await Tesseract.createWorker('chi_sim+eng', undefined, {
      langPath: possiblePaths.find((p) => {
        try {
          const { existsSync } = require('fs')
          return existsSync(join(p, 'chi_sim.traineddata'))
        } catch {
          return false
        }
      }) || possiblePaths[0],
    })

    return worker
  } finally {
    initializing = false
  }
}

export function setupOCR(): void {
  ipcMain.handle('ocr-image', async (_event, base64: string): Promise<string> => {
    try {
      const w = await getWorker()

      // Convert base64 to buffer
      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(cleanBase64, 'base64')

      const { data: { text } } = await w.recognize(buffer)
      return text.trim()
    } catch (err) {
      console.warn('[Niromi OCR] Recognition failed:', err)
      return ''
    }
  })
}

export async function cleanupOCR(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}
