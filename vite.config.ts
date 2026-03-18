import { defineConfig, build as viteBuild } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// Build worker files as standalone CJS — avoids vite-plugin-electron double-write race
function buildWorkers() {
  let built = false
  return {
    name: 'build-workers',
    async buildStart() {
      if (built) return
      built = true
      const workers = [
        { entry: 'electron/stt-worker.ts', out: 'stt-worker.cjs', external: ['@huggingface/transformers'] },
      ]
      for (const w of workers) {
        await viteBuild({
          configFile: false,
          build: {
            outDir: 'dist-electron',
            emptyOutDir: false,
            ssr: true,
            lib: {
              entry: w.entry,
              formats: ['cjs'],
              fileName: () => w.out,
            },
            rollupOptions: {
              external: [...w.external, 'worker_threads', 'module', 'fs', 'path', 'https', 'http'],
            },
          },
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'electron-store', 'worker_threads', '@huggingface/transformers'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              output: {
                entryFileNames: 'preload.js',
              },
            },
          },
        },
      },
    ]),
    renderer(),
    buildWorkers(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
