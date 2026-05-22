import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/generate': 'http://localhost:8001',
      '/status': 'http://localhost:8001',
      '/result': 'http://localhost:8001',
      '/health': 'http://localhost:8001',
    },
  },
})
