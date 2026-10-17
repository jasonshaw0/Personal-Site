# Jason Shaw

My personal website and project portfolio, available at **[jason-shaw.com](https://jason-shaw.com)**.

This site is a collection of selected projects, technical interests, and ways to get in touch.

The portfolio uses React, TypeScript, and Vite. The public blog at `/blog` uses Astro and Markdown/MDX. Cloudflare Workers serves both static builds and forwards contact submissions to the existing contact Worker.

## Local development

Use Node **22.22 or newer** (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the Vite URL (normally `http://127.0.0.1:5173`). Blog requests are proxied to Astro on port 4321. `npm run dev:blog` starts just Astro for writing. The portfolio retains its four hash-based sections; Writing is a separate link, including in the mobile menu.

## Writing

Add a normal `.md` file to `blog/content/`. Its filename becomes the URL slug unless frontmatter supplies `slug`. Use a flat filename or an explicit slug for nested files. Slugs must contain lowercase letters, digits, and single hyphens, and must be unique across all posts; `index` is reserved for the archive. `.mdx` files use the same schema and can import custom Astro/MDX components.

```yaml
---
title: "Your article title"
description: "A short description for the archive, feeds, and search results."
slug: your-article-title
date: 2026-10-16
status: draft
tags: [Software, Engineering]
featured: false
toc: true
# updated: 2026-10-17
# cover: /blog/images/your-image.webp
# coverAlt: "A meaningful description of the image"
# coverCaption: "Optional caption or credit"
---
```

Set `status: published` and rebuild to publish at `/blog/your-article-title`. Missing status defaults to `draft`. Drafts and future-dated posts have no public page and are excluded from listings, RSS, related links, and the sitemap. Future publication requires a new build after the date; there is no scheduler. Dates without a time mean midnight UTC. `updated` cannot precede `date`. Cover images require alt text.

`formatting-example.md` is an explicitly unpublished formatting reference. There are no fabricated published posts or public draft previews. **Tracked draft files are still visible to anyone who can read the Git repository.** Keep confidential writing outside this repository.

Put article images in `public/blog/images/` and reference them with root-relative URLs. Standard Markdown supports headings, tables, lists, links, blockquotes, images, and highlighted fenced code blocks. For captions and diagrams, use semantic HTML figures and accessible inline SVG; native video/audio and titled, appropriately sandboxed iframes are supported. MDX is available for content that actually needs components. Content and MDX are trusted author source, not an untrusted upload endpoint.

The article layout adds reading time, optional contents (three or more section headings), code-copy controls with a selection fallback, related notes by shared tags, and older/newer navigation. The archive supports tag filtering with shareable `?tag=` URLs and browser history. Articles and listings remain readable without JavaScript; filters and copy controls progressively enhance them.

## Build and deployment

```sh
npm run build
npm run preview:worker
```

The build checks TypeScript and Astro, builds the portfolio into `dist/`, builds Astro separately into `.blog-dist/`, then merges blog output into `dist/` with collision checks. Blog assets live under `/_blog/`; palette, fonts, and visual identity are shared while layouts and scrolling remain independent. `npm run preview` offers a simple static preview; use the Worker preview on port 8787 to check actual redirects and 404 handling.

`npm run deploy` uses the existing `wrangler.toml` build and routes. It requires authentication to the configured Cloudflare account. No new Worker, database, CMS, or paid service is needed. The contact binding is unchanged. Do not enable an SPA fallback: the portfolio uses hashes on `/`, and missing article/asset URLs must return a real 404. Cloudflare drops trailing slashes to match canonical URLs.

Canonical metadata uses the existing `https://www.jason-shaw.com` origin. `/rss.xml`, `/sitemap.xml`, and `/robots.txt` are generated/served with published content only. Articles include Open Graph, Twitter, and BlogPosting JSON-LD metadata. A shared 1200×630 social card is in `public/blog-og.png`; regenerate it with `node scripts/generate-blog-og.mjs`.

## Verification

```sh
npm test
npm run test:blog
npx wrangler deploy --dry-run
```

Worker tests cover contact behavior and routing. The blog integration check builds isolated temporary Markdown/MDX fixtures, checks rendering and SEO, and proves drafts/default drafts/future posts are absent from public output. It then restores the real content build and checks that temporary routes are removed. `BLOG_CONTENT_DIR` is reserved for this isolated test source; leave it unset for normal development and deployment.

For browser review of a populated archive without publishing sample articles, run `npm run test:blog -- --review`, then `npm run preview` and inspect `/blog` and `/blog/verification-markdown`. This leaves clearly marked verification pages in `dist/` only. **Run `npm run build` afterward.** `preview:worker` also runs that clean build, so it does not retain verification pages. Browser checks use Playwriter exclusively.
