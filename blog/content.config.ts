import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { pathToFileURL } from 'node:url'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: process.env.BLOG_CONTENT_DIR ? pathToFileURL(`${process.env.BLOG_CONTENT_DIR}/`) : './blog/content' }),
  schema: z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(320),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
    cover: z.preprocess(value => value === '' ? undefined : value, z.string().regex(/^(\/[^/]|https:\/\/)/, 'Use a root-relative path or HTTPS URL').optional()),
    coverAlt: z.string().optional(),
    coverCaption: z.string().optional(),
    featured: z.boolean().default(false),
    toc: z.boolean().default(true),
  }).refine(data => !data.cover || Boolean(data.coverAlt?.trim()), {
    message: 'Cover images require coverAlt text', path: ['coverAlt'],
  }).refine(data => !data.updated || data.updated >= data.date, {
    message: 'Updated date cannot precede publication date', path: ['updated'],
  }),
})

export const collections = { posts }
