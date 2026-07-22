import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

export default defineConfig({
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
