import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // exceljs의 Node 전용 진입점 대신 브라우저용 빌드를 사용
      'exceljs': path.resolve(__dirname, 'node_modules/exceljs/dist/exceljs.min.js'),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['exceljs'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
