import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
  server: {
    proxy: { '/api/contact': { target: 'https://contact.jason-shaw.com', changeOrigin: true } },
  },
})
