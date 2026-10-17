import { getCollection, type CollectionEntry } from 'astro:content'

export type Post = CollectionEntry<'posts'>
export const postSlug = (post: Post) => post.data.slug ?? post.id
export const postUrl = (post: Post) => `/blog/${postSlug(post)}`
export const readingTime = (post: Post) => Math.max(1, Math.ceil((post.body ?? '').split(/\s+/).filter(Boolean).length / 220))
export const formatDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)

export async function publishedPosts() {
  const posts = await getCollection('posts')
  const slugs = new Set<string>()
  // Validate all slugs, including drafts, so publishing cannot silently collide.
  for (const post of posts) {
    const slug = postSlug(post)
    if (slug === 'index' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) {
      throw new Error(`Invalid or duplicate blog slug: ${slug}. Set a unique frontmatter slug.`)
    }
    slugs.add(slug)
  }
  return posts.filter(post => post.data.status === 'published' && post.data.date <= new Date())
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || postSlug(a).localeCompare(postSlug(b)))
}
