import { fileURLToPath } from 'node:url'
import path from 'node:path'
import config from '../astro.config.mjs'

if (!process.env.BLOG_CONTENT_DIR) throw new Error('This config is only for isolated blog verification.')
const root = path.resolve(process.env.BLOG_CONTENT_DIR)
export default {
  ...config,
  root,
  srcDir: fileURLToPath(new URL('../blog/', import.meta.url)),
  outDir: fileURLToPath(new URL('../.blog-dist/', import.meta.url)),
  cacheDir: path.join(root, '.cache'),
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  vite: { ...config.vite, cacheDir: path.join(root, '.vite') },
}
