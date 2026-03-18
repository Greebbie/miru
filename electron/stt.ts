/**
 * stt.ts — Whisper STT manager (main process)
 * Mirrors vision.ts pattern: worker lifecycle + IPC bridge.
 */

import { Worker } from 'worker_threads'
import path from 'path'

let worker: Worker | null = null
let initialized = false
let initPromise: Promise<void> | null = null

export function isSTTInitialized(): boolean {
  return initialized
}

export async function initSTT(
  cacheDir: string,
  modelId: string = 'Xenova/whisper-tiny',
  onProgress?: (progress: { status: string; progress?: number; file?: string }) => void,
  electronDir?: string
): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = new Promise<void>((resolve, reject) => {
    const dir = electronDir || __dirname
    const workerPath = path.join(dir, 'stt-worker.cjs')
    worker = new Worker(workerPath)

    // 5 minutes timeout for first-time model download (~75MB+)
    const timeout = setTimeout(() => {
      reject(new Error('STT worker init timeout (model download may have failed)'))
      initPromise = null
    }, 300000)

    const handler = (msg: { type: string; error?: string; status?: string; progress?: number; file?: string }) => {
      if (msg.type === 'init-done') {
        clearTimeout(timeout)
        worker?.off('message', handler)
        initialized = true
        resolve()
      } else if (msg.type === 'init-error') {
        clearTimeout(timeout)
        worker?.off('message', handler)
        worker?.terminate()
        worker = null
        initPromise = null
        reject(new Error(msg.error || 'STT init failed'))
      } else if (msg.type === 'progress' && onProgress) {
        onProgress({ status: msg.status || '', progress: msg.progress, file: msg.file })
      }
    }

    worker.on('message', handler)
    worker.once('error', (err) => {
      clearTimeout(timeout)
      worker?.terminate()
      worker = null
      initPromise = null
      reject(err)
    })

    worker.postMessage({ type: 'init', cacheDir, modelId })
  })

  return initPromise
}

export async function transcribeAudio(
  audioData: Float32Array | ArrayBuffer | ArrayBufferView | Record<string, number>,
  language?: string
): Promise<{ text: string }> {
  if (!worker || !initialized) {
    throw new Error('STT not initialized. Call initSTT() first.')
  }

  // Defensive: ensure audioData is Float32Array (IPC may serialize differently)
  let audio: Float32Array
  if (audioData instanceof Float32Array) {
    audio = audioData
  } else if (audioData instanceof ArrayBuffer) {
    audio = new Float32Array(audioData)
  } else if (ArrayBuffer.isView(audioData)) {
    audio = new Float32Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 4)
  } else {
    // Serialized as plain object — rebuild from values
    audio = new Float32Array(Object.values(audioData as Record<string, number>))
  }

  return new Promise<{ text: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('STT transcribe timeout'))
    }, 60000)

    const handler = (msg: { type: string; text?: string; error?: string }) => {
      if (msg.type === 'transcribe-done') {
        clearTimeout(timeout)
        worker?.off('message', handler)
        resolve({ text: msg.text || '' })
      } else if (msg.type === 'transcribe-error') {
        clearTimeout(timeout)
        worker?.off('message', handler)
        reject(new Error(msg.error || 'Transcribe failed'))
      }
    }

    worker!.on('message', handler)

    // Transfer the Float32Array buffer for zero-copy
    const buffer = audio.buffer.slice(
      audio.byteOffset,
      audio.byteOffset + audio.byteLength
    ) as ArrayBuffer
    const transferred = new Float32Array(buffer)
    worker!.postMessage(
      { type: 'transcribe', audioData: transferred, language },
      [transferred.buffer as ArrayBuffer]
    )
  })
}

export function destroySTT(): void {
  if (worker) {
    worker.terminate()
    worker = null
  }
  initialized = false
  initPromise = null
}
