import rss from '@astrojs/rss'
import { publishedPosts, postUrl } from '../lib/posts'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  return rss({
    title: 'Jason Shaw · Writing',
    description: 'Notes on software, engineering, and the process of making things work.',
    site: context.site!,
    trailingSlash: false,
    items: (await publishedPosts()).map(post => ({
      title: post.data.title, description: post.data.description,
      pubDate: post.data.date, link: postUrl(post), categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  })
}
