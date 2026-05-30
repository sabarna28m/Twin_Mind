import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // listen on 0.0.0.0 so Docker port mapping works
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,   // needed on Windows — NTFS events don't reach the container
      interval: 1000,
    },
  },
})
