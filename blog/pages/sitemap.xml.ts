import { publishedPosts, postUrl } from '../lib/posts'
import type { APIContext } from 'astro'

export async function GET({ site }: APIContext) {
  const posts = await publishedPosts()
  const escape = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
  const urls = [{ path: '/' }, { path: '/blog' }, ...posts.map(post => ({ path: postUrl(post), date: post.data.updated ?? post.data.date }))]
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(item => `<url><loc>${escape(new URL(item.path, site).href)}</loc>${'date' in item && item.date ? `<lastmod>${item.date.toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml' } })
}
