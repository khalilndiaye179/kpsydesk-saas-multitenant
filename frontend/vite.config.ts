import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Port 3011 — Frontend Vite dev server (voir PORTS.md)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3011,
    host: true,
    watch: {
      usePolling: true,
    },
    // Proxy vers le backend NestJS sur le port 3010
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3011,
  },
})
