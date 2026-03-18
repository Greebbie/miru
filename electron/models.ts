import fs from 'fs'
import path from 'path'
import https from 'https'

// Original Ultralytics/YOLOv8 repo only has .pt files, not ONNX.
// Use s1777/yolo-v8n-onnx which has the pre-exported ONNX model.
const YOLO_URL = (process.env.HF_MIRROR || 'https://hf-mirror.com') + '/s1777/yolo-v8n-onnx/resolve/main/yolov8n.onnx'

/**
 * Ensure ONNX model exists locally. Download from Hugging Face if missing.
 * Returns the full path to the model file.
 */
export async function ensureModel(modelDir: string, modelName: string): Promise<string> {
  const modelPath = path.join(modelDir, `${modelName}.onnx`)

  if (fs.existsSync(modelPath)) return modelPath

  // Create directory
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true })
  }

  // Download
  const url = modelName === 'yolov8n' ? YOLO_URL : YOLO_URL
  await downloadFile(url, modelPath)
  return modelPath
}

function downloadFile(url: string, dest: string, maxRedirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl: string, redirectsLeft: number) => {
      const file = fs.createWriteStream(dest)
      const protocol = reqUrl.startsWith('http://') ? require('http') : https
      protocol.get(reqUrl, { timeout: 120000 }, (res: import('http').IncomingMessage) => {
        // Handle redirects (301, 302, 303, 307, 308)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          file.close()
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
          const location = res.headers.location
          if (!location) {
            reject(new Error('Redirect without location'))
            return
          }
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects'))
            return
          }
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
