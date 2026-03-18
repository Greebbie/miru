import { Worker } from 'worker_threads'
import path from 'path'

export interface VisionResult {
  detections: { label: string; confidence: number; bbox: [number, number, number, number] }[]
  ocrText: string
  summary: string
}

let worker: Worker | null = null
let initialized = false
let initPromise: Promise<void> | null = null

export function isVisionInitialized(): boolean {
  return initialized
}

export async function initVision(modelDir: string, electronDir?: string): Promise<void> {
  if (initPromise) return initPromise

  initPromise = new Promise<void>((resolve, reject) => {
    const dir = electronDir || __dirname
    const workerPath = path.join(dir, 'vision-worker.cjs')
    worker = new Worker(workerPath)

    const timeout = setTimeout(() => {
      initPromise = null
      reject(new Error('Vision worker init timeout'))
    }, 120000) // 2 min for model download

    worker.once('message', (msg: { type: string; error?: string }) => {
      clearTimeout(timeout)
      if (msg.type === 'init-done') {
        initialized = true
        resolve()
      } else if (msg.type === 'init-error') {
        initPromise = null
        reject(new Error(msg.error || 'Vision init failed'))
      }
    })

    worker.once('error', (err) => {
      clearTimeout(timeout)
      initPromise = null
      reject(err)
    })

    worker.postMessage({ type: 'init', modelDir })
  })

  return initPromise
}

export async function analyzeScreen(jpegBuffer: Buffer): Promise<VisionResult> {
  if (!worker || !initialized) {
    return { detections: [], ocrText: '', summary: 'Vision not initialized' }
  }

  return new Promise<VisionResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Vision analyze timeout'))
    }, 30000)

    const handler = (msg: { type: string; result?: VisionResult; error?: string }) => {
      if (msg.type === 'analyze-done') {
        clearTimeout(timeout)
        worker?.off('message', handler)
        resolve(msg.result || { detections: [], ocrText: '', summary: 'No result' })
      } else if (msg.type === 'analyze-error') {
        clearTimeout(timeout)
        worker?.off('message', handler)
        reject(new Error(msg.error || 'Analyze failed'))
      }
    }

    worker!.on('message', handler)
    worker!.postMessage({ type: 'analyze', jpegBuffer: new Uint8Array(jpegBuffer) })
  })
}
