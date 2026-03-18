/**
 * vision-worker.ts — worker_threads-based CJS module
 * Runs ONNX YOLO inference and Tesseract OCR off the main thread.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { parentPort } = require('worker_threads')
const { createRequire } = require('module')
const fs = require('fs') as typeof import('fs')
const path = require('path') as typeof import('path')
const https = require('https') as typeof import('https')

const nativeRequire = createRequire(__filename)
const ort = nativeRequire('onnxruntime-node')
const sharp = nativeRequire('sharp')
const Tesseract = nativeRequire('tesseract.js')

// Inlined from models.ts to avoid cross-module CJS/ESM issues in worker_threads
const YOLO_URL = (process.env.HF_MIRROR || 'https://hf-mirror.com') + '/s1777/yolo-v8n-onnx/resolve/main/yolov8n.onnx'

async function ensureModel(modelDir: string, modelName: string): Promise<string> {
  const modelPath = path.join(modelDir, `${modelName}.onnx`)
  if (fs.existsSync(modelPath)) return modelPath
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true })
  await downloadFile(YOLO_URL, modelPath)
  return modelPath
}

function downloadFile(url: string, dest: string, maxRedirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl: string, redirectsLeft: number) => {
      const file = fs.createWriteStream(dest)
      const protocol = reqUrl.startsWith('http://') ? nativeRequire('http') : https
      protocol.get(reqUrl, { timeout: 120000 }, (res: import('http').IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          file.close()
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
          const location = res.headers.location
          if (!location) { reject(new Error('Redirect without location')); return }
          if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return }
          doRequest(location, redirectsLeft - 1)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
          reject(new Error(`Download failed: ${res.statusCode}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', (err: Error) => {
        file.close()
        try { fs.unlinkSync(dest) } catch { /* ignore */ }
        reject(err)
      })
    }
    doRequest(url, maxRedirects)
  })
}

// COCO 80 class labels
const COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
]

interface Detection {
  label: string
  confidence: number
  bbox: [number, number, number, number]
}

interface VisionResult {
  detections: Detection[]
  ocrText: string
  summary: string
}

let yoloSession: InstanceType<typeof ort.InferenceSession> | null = null

// ── IOU ──────────────────────────────────────────────────────────────

function iou(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])

  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])

  return inter / (areaA + areaB - inter + 1e-6)
}

// ── NMS ──────────────────────────────────────────────────────────────

function nms(boxes: Detection[], iouThreshold: number): Detection[] {
  const kept: Detection[] = []

  for (const box of boxes) {
    let dominated = false
    for (const keptBox of kept) {
      if (iou(box.bbox, keptBox.bbox) > iouThreshold) {
        dominated = true
        break
      }
    }
    if (!dominated) kept.push(box)
  }

  return kept
}

// ── YOLO inference ───────────────────────────────────────────────────

async function runYolo(jpegBuffer: Buffer): Promise<Detection[]> {
  if (!yoloSession) return []

  // Letterbox resize to 640x640 with gray padding (not fill/stretch)
  const { data } = await sharp(jpegBuffer)
    .resize(640, 640, {
      fit: 'contain',
      background: { r: 114, g: 114, b: 114 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // HWC → CHW + normalize to [0, 1]
  const float32 = new Float32Array(3 * 640 * 640)
  const pixels = 640 * 640
  for (let i = 0; i < pixels; i++) {
    float32[i] = data[i * 3] / 255.0                 // R
    float32[pixels + i] = data[i * 3 + 1] / 255.0    // G
    float32[2 * pixels + i] = data[i * 3 + 2] / 255.0 // B
  }

  const inputTensor = new ort.Tensor('float32', float32, [1, 3, 640, 640])
  const results = await yoloSession.run({ images: inputTensor })

  // YOLOv8 output: [1, 84, 8400] — 4 bbox + 80 class scores per candidate
  const output = results[Object.keys(results)[0]]
  if (!output) return []

  const outputData = output.data as Float32Array
  const numCandidates = 8400
  const numClasses = 80

  const candidates: Detection[] = []

  for (let i = 0; i < numCandidates; i++) {
    // Find max class score
    let maxScore = 0
    let maxClass = 0
    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * numCandidates + i]
      if (score > maxScore) {
        maxScore = score
        maxClass = c
      }
    }

    if (maxScore < 0.25) continue

    // Get bbox (cx, cy, w, h) in 640x640 space
    const cx = outputData[0 * numCandidates + i]
    const cy = outputData[1 * numCandidates + i]
    const w = outputData[2 * numCandidates + i]
    const h = outputData[3 * numCandidates + i]

    candidates.push({
      label: COCO_LABELS[maxClass] || `class_${maxClass}`,
      confidence: maxScore,
      bbox: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
    })
  }

  // Sort by confidence and take top 20
  candidates.sort((a, b) => b.confidence - a.confidence)
  const top = candidates.slice(0, 20)

  // Simple NMS
  return nms(top, 0.45)
}

// ── OCR ──────────────────────────────────────────────────────────────

async function runOcr(jpegBuffer: Buffer): Promise<string> {
  try {
    // Use Tesseract.recognize() directly — no createWorker needed,
    // which avoids Web Worker API dependency in worker_threads context
    const result = await Tesseract.recognize(jpegBuffer, 'eng+chi_sim')
    return result.data.text.trim().slice(0, 500)
  } catch {
    return ''
  }
}

// ── Message handler ──────────────────────────────────────────────────

if (!parentPort) {
  throw new Error('vision-worker must be run inside a worker_thread')
}

parentPort.on('message', async (msg: { type: string; modelDir?: string; jpegBuffer?: Uint8Array }) => {
  try {
    if (msg.type === 'init') {
      const modelDir = msg.modelDir!
      const modelPath = await ensureModel(modelDir, 'yolov8n')
      yoloSession = await ort.InferenceSession.create(modelPath)
      parentPort!.postMessage({ type: 'init-done' })
    } else if (msg.type === 'analyze') {
      const jpegBuffer = Buffer.from(msg.jpegBuffer!)

      // Run YOLO and OCR in parallel
      const [detections, ocrText] = await Promise.all([
        runYolo(jpegBuffer),
        runOcr(jpegBuffer),
      ])

      // Build summary
      const detSummary = detections.length > 0
        ? detections.map((d) => d.label).join(', ')
        : 'no objects detected'
      const ocrSummary = ocrText.slice(0, 200).replace(/\n/g, ' ').trim()

      const result: VisionResult = {
        detections,
        ocrText,
        summary: `Detected: ${detSummary}${ocrSummary ? ` | Text: ${ocrSummary}` : ''}`,
      }

      parentPort!.postMessage({ type: 'analyze-done', result })
    }
  } catch (err: any) {
    parentPort!.postMessage({
      type: msg.type === 'init' ? 'init-error' : 'analyze-error',
      error: err?.message || String(err),
    })
  }
})
