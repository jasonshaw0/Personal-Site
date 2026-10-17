import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
  server: {
    proxy: {
      '/api/contact': { target: 'https://contact.jason-shaw.com', changeOrigin: true },
      '/blog': 'http://127.0.0.1:4321',
      '/_blog': 'http://127.0.0.1:4321',
      '/_astro': 'http://127.0.0.1:4321',
      '^/@id/(?:astro:|__x00__astro)': 'http://127.0.0.1:4321',
      '/node_modules/.vite-blog': 'http://127.0.0.1:4321',
      '/rss.xml': 'http://127.0.0.1:4321',
      '/sitemap.xml': 'http://127.0.0.1:4321',
    },
  },
})
