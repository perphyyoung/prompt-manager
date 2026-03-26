import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        formats: ['es']
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        },
        external: ['electron', 'sqlite3', 'sharp']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: {
        entry: path.resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs']
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        },
        external: ['electron']
      }
    }
  },
  renderer: {
    root: path.resolve(__dirname, 'src/renderer'),
    build: {
      outDir: path.resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
})
