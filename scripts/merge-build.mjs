import { copyFile, readdir, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

// Vite owns dist/. Astro writes separately so neither build can erase the other.
async function merge(relative = '') {
  for (const entry of await readdir(path.join('.blog-dist', relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name)
    const source = path.join('.blog-dist', file)
    const destination = path.join('dist', file)
    if (entry.isDirectory()) {
      await mkdir(destination, { recursive: true })
      await merge(file)
      continue
    }
    if (file === 'index.html') throw new Error('Blog output would overwrite the portfolio entry.')
    try {
      const existing = await readFile(destination)
      if (!existing.equals(await readFile(source))) throw new Error(`Build output collision: ${destination}`)
      // Both builders copy public/. Identical shared assets are safe to reuse.
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await copyFile(source, destination)
    }
  }
}
await merge()
console.log('Merged static blog into dist/.')
