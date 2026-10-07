import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { contentPolicy, securityHeaders } from './securityPolicy.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBase = env.VITE_API_BASE_URL || ''
  const headers = securityHeaders(apiBase)
  return {
    server: { proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5000', '/uploads': process.env.API_PROXY_TARGET || 'http://localhost:5000' } },
    preview: { headers, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000', '/uploads': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000' } },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'production-browser-security',
        apply: 'build',
        transformIndexHtml: { order: 'post', handler: () => [
          { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentPolicy(apiBase) }, injectTo: 'head-prepend' },
          { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
        ] },
        generateBundle() {
          // Netlify/Cloudflare Pages consume this file. Other hosts must apply
          // these same headers in their web-server/CDN configuration.
          this.emitFile({ type: 'asset', fileName: 'security-headers.json', source: JSON.stringify(headers) })
          this.emitFile({ type: 'asset', fileName: '_headers', source: '/*\n' + Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`).join('\n') + '\n' })
        },
      },
    ],
  }
})
