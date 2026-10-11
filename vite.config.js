import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

export default defineConfig({
  // Rutas relativas: imprescindible para que la app Electron empaquetada
  // (que carga dist/index.html via file://) resuelva los assets contra dist/
  // y no contra la raiz del sistema de archivos.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: OLLAMA_URL,
        changeOrigin: true,
      },
    },
  },
})
