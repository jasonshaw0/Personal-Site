import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'

export default defineConfig({
  site: 'https://www.jason-shaw.com',
  srcDir: './blog',
  outDir: './.blog-dist',
  publicDir: './public',
  output: 'static',
  trailingSlash: 'never',
  integrations: [mdx()],
  build: { assets: '_blog' },
  markdown: { shikiConfig: { theme: 'github-dark-dimmed', wrap: false } },
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  vite: { cacheDir: './node_modules/.vite-blog' },
})
