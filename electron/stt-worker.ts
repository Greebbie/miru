/**
 * stt-worker.ts — worker_threads-based Whisper STT
 * Runs @huggingface/transformers Whisper pipeline off the main thread.
 */

import { parentPort } from 'worker_threads'
import { createRequire } from 'module'

const nativeRequire = createRequire(__filename)

let pipeline: any = null
let transcriber: any = null

if (!parentPort) {
  throw new Error('stt-worker must be run inside a worker_thread')
}

parentPort.on('message', async (msg: {
  type: string
  cacheDir?: string
  modelId?: string
  audioData?: Float32Array
  language?: string
}) => {
  try {
    if (msg.type === 'init') {
      const { pipeline: pipelineFn, env } = nativeRequire('@huggingface/transformers')

      // Configure cache and optional mirror for China
      if (msg.cacheDir) {
        env.cacheDir = msg.cacheDir
      }
      // HuggingFace mirror — default to China-accessible mirror
      // Must end with '/' to match lib's pathJoin expectations
      const mirror = process.env.HF_MIRROR || 'https://hf-mirror.com'
      env.remoteHost = mirror.endsWith('/') ? mirror : mirror + '/'

      // Disable local model check to allow downloading
      env.allowLocalModels = true
      env.allowRemoteModels = true

      const modelId = msg.modelId || 'Xenova/whisper-tiny'

      // Report download progress
      transcriber = await pipelineFn('automatic-speech-recognition', modelId, {
        progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
          parentPort!.postMessage({ type: 'progress', ...progress })
        },
      })

      pipeline = pipelineFn
      parentPort!.postMessage({ type: 'init-done' })
    } else if (msg.type === 'transcribe') {
      if (!transcriber) {
        parentPort!.postMessage({ type: 'transcribe-error', error: 'STT not initialized' })
        return
      }

      const audioData = msg.audioData!
      const options: Record<string, unknown> = {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      }

      if (msg.language) {
        options.language = msg.language
      }

      const result = await transcriber(audioData, options)
      parentPort!.postMessage({
        type: 'transcribe-done',
        text: result.text?.trim() || '',
      })
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err)
    const isNetwork = /fetch|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|ssl|certificate/i.test(errMsg)
    parentPort!.postMessage({
      type: msg.type === 'init' ? 'init-error' : 'transcribe-error',
      error: isNetwork
        ? `网络错误: ${errMsg.slice(0, 200)}`
        : errMsg,
    })
  }
})
