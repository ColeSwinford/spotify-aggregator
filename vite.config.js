import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/spotify-aggregator/",
  // https://vitejs.dev/config/
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  // Fix for "import.meta" error by targeting modern browsers
  esbuild: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  },
  build: {
    target: 'es2022'
  }
})