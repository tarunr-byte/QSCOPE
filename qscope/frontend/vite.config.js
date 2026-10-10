import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/version': 'http://127.0.0.1:8000',
      '/upload-csv': 'http://127.0.0.1:8000',
      '/analyze-window': 'http://127.0.0.1:8000',
      '/decision': 'http://127.0.0.1:8000',
      '/history': 'http://127.0.0.1:8000',
      '/audit-log': 'http://127.0.0.1:8000',
      '/export': 'http://127.0.0.1:8000',
      '/quantum': 'http://127.0.0.1:8000',
    }
  }
})
