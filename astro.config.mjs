import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export default defineConfig({
  site: 'https://www.jason-shaw.com',
  srcDir: './blog',
  outDir: './.blog-dist',
  publicDir: './public',
  output: 'static',
  trailingSlash: 'never',
  integrations: [mdx()],
  build: { assets: '_blog' },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 1000 }]],
    }),
    shikiConfig: { theme: 'github-dark-dimmed', wrap: false },
  },
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  vite: { cacheDir: './node_modules/.vite-blog' },
})
