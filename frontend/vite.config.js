import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    allowedHosts: ['ty-bardish-silvia.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})