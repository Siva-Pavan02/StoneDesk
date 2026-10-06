import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5000', '/uploads': process.env.API_PROXY_TARGET || 'http://localhost:5000' } },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
