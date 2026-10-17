import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, access, readdir, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { load } from 'cheerio'
import path from 'node:path'

const prefix = 'verification-'
const reviewing = process.argv.includes('--review')
await mkdir('artifacts', { recursive: true })
const fixtureDir = await mkdtemp('artifacts/blog-fixtures-')
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } })
  assert.equal(result.status, 0, `${file} ${args.join(' ')} failed`)
}
const build = () => {
  run('node_modules/vite/bin/vite.js', ['build'])
  run('node_modules/astro/bin/astro.mjs', ['build', ...(process.env.BLOG_CONTENT_DIR ? ['--config', 'scripts/astro-test.config.mjs'] : [])])
  run('scripts/merge-build.mjs', [])
}
const exists = async file => { try { await access(file); return true } catch { return false } }
const html = async file => load(await readFile(path.join('dist', file), 'utf8'))
async function fixture(name, frontmatter, body = 'Example verification content. Not a real published article.', extension = 'md') {
  const file = `${fixtureDir}/${prefix}${name}.${extension}`
  assert.equal(await exists(file), false, `Refusing to overwrite ${file}`)
  await writeFile(file, `---\ntitle: "Verification example: ${name}"\ndescription: "Temporary test article; never publish as real writing."\nslug: ${prefix}${name}\n${/^date:/m.test(frontmatter) ? '' : 'date: 2025-01-02\n'}${frontmatter}\n---\n\n${body}\n`)
}

try {
  process.env.BLOG_CONTENT_DIR = path.resolve(fixtureDir)
  await fixture('markdown', 'status: published\ntags: [Software, Engineering]\nfeatured: true\ncover: /favicon.svg\ncoverAlt: Verification cover', `## First heading

An example with **bold**, *emphasis*, [a link](https://example.com), and \`inline code\`.

> A useful quoted observation.

- First item
- Second item

## Code and tables

\`\`\`typescript
const greeting: string = "hello";
console.log(greeting);
\`\`\`

| Input | Output |
| --- | --- |
| Markdown | Static HTML |

### A smaller heading

## Diagram and caption

<figure><svg viewBox="0 0 400 80" role="img" aria-label="Verification diagram"><rect width="400" height="80" fill="#303538"/><text x="20" y="48" fill="#bfd4cd">Source → Build → Page</text></svg><figcaption>A responsive technical diagram.</figcaption></figure>

<iframe title="Verification embed" src="about:blank" loading="lazy"></iframe>

![Verification image](/favicon.svg)

## A final observation

This content tests rendering only. It describes no actual completed work.`)
  await fixture('mdx', 'status: published\ntags: [Software]\ndate: 2025-02-03', `export const result = 2 + 2

## An MDX component

<p>Interactive-ready MDX result: {result}</p>`, 'mdx')
  await fixture('hardware', 'status: published\ntags: [Hardware]\ndate: 2024-03-04\ncover: ""\ncoverAlt: ""\ncoverCaption: ""')
  await fixture('draft', 'status: draft\ntags: [SecretDraftTag]', 'DRAFT_SENTINEL_MUST_NOT_SHIP')
  await fixture('default-draft', 'tags: [DefaultDraftTag]', 'DEFAULT_DRAFT_SENTINEL')
  await fixture('scheduled', 'status: published\ndate: 2999-01-01\ntags: [FutureTag]', 'FUTURE_SENTINEL_MUST_NOT_SHIP')
  build()

  const index = await html('blog/index.html')
  assert.equal(index('h1').text().replace(/\s+/g, ' ').trim(), 'A little furtherinto the details.')
  assert.equal(index('[data-entry]').length, 3)
  assert.equal(index('[data-year]').length, 2)
  assert.equal(index('.featured-post').length, 1)
  assert(index('[data-tag="Software"]').length)
  const article = await html(`blog/${prefix}markdown/index.html`)
  assert.equal(article('h1').text(), 'Verification example: markdown')
  assert.equal(article('.prose h2').length, 4)
  assert.equal(article('.prose h3').length, 1)
  assert.equal(article('.table-of-contents a').length, 5)
  assert.equal(article('.prose table').length, 1)
  assert(article('.prose blockquote').text().includes('useful quoted observation'))
  assert.equal(article('.prose pre code').text().trim(), 'const greeting: string = "hello";\nconsole.log(greeting);')
  assert(article('.prose pre span[style]').length > 0, 'Code syntax must be highlighted')
  assert.equal(article('.prose svg[role="img"]').length, 1)
  assert.equal(article('.prose iframe[title]').length, 1)
  assert.equal(article('link[rel="canonical"]').attr('href'), 'https://www.jason-shaw.com/blog/verification-markdown')
  assert.equal(article('meta[property="og:type"]').attr('content'), 'article')
  assert.equal(article('meta[property="og:image"]').attr('content'), 'https://www.jason-shaw.com/favicon.svg')
  assert.equal(article('meta[property="article:published_time"]').attr('content'), '2025-01-02T00:00:00.000Z')
  const structured = JSON.parse(article('script[type="application/ld+json"]').text())
  assert.equal(structured['@type'], 'BlogPosting')
  assert.equal(structured.author.name, 'Jason Shaw')
  assert.equal(article('.related .post-card').length, 1)
  assert.equal(article('.article-pagination a').length, 2)
  const mdx = await html(`blog/${prefix}mdx/index.html`)
  assert(mdx('.prose').text().includes('Interactive-ready MDX result: 4'))

  const rss = load(await readFile('dist/rss.xml', 'utf8'), { xml: true })
  assert.equal(rss('item').length, 3)
  assert.equal(rss('item').first().find('link').text(), 'https://www.jason-shaw.com/blog/verification-mdx')
  const sitemap = load(await readFile('dist/sitemap.xml', 'utf8'), { xml: true })
  assert.equal(sitemap('url').length, 5)
  for (const name of ['draft', 'default-draft', 'scheduled', 'formatting-example']) {
    const slug = name === 'formatting-example' ? name : prefix + name
    assert.equal(await exists(`dist/blog/${slug}`), false, `Unpublished route leaked: ${slug}`)
    assert(!index.html().includes(slug), `Unpublished article listed: ${slug}`)
    assert(!rss.xml().includes(slug), `Unpublished article in RSS: ${slug}`)
    assert(!sitemap.xml().includes(slug), `Unpublished article in sitemap: ${slug}`)
  }
  assert.equal((await html('404.html'))('meta[name="robots"]').attr('content'), 'noindex, follow')
  assert((await readFile('dist/index.html', 'utf8')).includes('id="root"'), 'Portfolio entry missing')
  const allFiles = await readdir('dist', { recursive: true })
  for (const file of allFiles.filter(file => /\.(html|js|xml|json|md|mdx)$/.test(file))) {
    assert(!/DRAFT_SENTINEL|FUTURE_SENTINEL|SecretDraftTag/.test(await readFile(path.join('dist', file), 'utf8')), `Draft data leaked into ${file}`)
  }
  console.log('\nBlog integration checks passed: Markdown, MDX, routes, archive, metadata, RSS, sitemap, related articles, draft and future-date exclusion.')
} finally {
  delete process.env.BLOG_CONTENT_DIR
  const resolvedFixtures = path.resolve(fixtureDir)
  assert(resolvedFixtures.startsWith(`${path.resolve('artifacts')}${path.sep}`), 'Test cleanup must stay inside artifacts/')
  await rm(resolvedFixtures, { recursive: true, force: true })
  if (!reviewing) {
    build()
    const index = await html('blog/index.html')
    if (!index('[data-entry]').length) assert.equal(index('.empty-state').length, 1)
    assert.equal(await exists('dist/blog/verification-markdown'), false, 'A stale verification page survived rebuild')
    assert(!load(await readFile('dist/rss.xml', 'utf8'), { xml: true })('item').text().includes('Verification example:'))
    console.log('Clean build restored; empty state and removal of unpublished pages verified.')
  } else {
    console.log('Review build remains in dist/ with clearly marked temporary examples. Run npm run build before deployment. Fixture source files have been removed.')
  }
}
