import { z } from "zod";
import { parseDocument, stringify } from "yaml";

export const metadataSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(320),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .refine((value) => value !== "index", "index is reserved"),
    date: z
      .string()
      .refine(
        (value) => Number.isFinite(Date.parse(value)),
        "Use a valid publication date",
      ),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    cover: z
      .string()
      .max(2000)
      .refine(
        (value) => !value || /^(\/[^/]|https:\/\/)/.test(value),
        "Use a root-relative path or HTTPS URL",
      )
      .default(""),
    coverAlt: z.string().max(500).default(""),
    coverCaption: z.string().max(1000).default(""),
    featured: z.boolean().default(false),
    toc: z.boolean().default(true),
    updated: z.string().optional(),
  })
  .refine((data) => !data.cover || Boolean(data.coverAlt.trim()), {
    message: "Cover images require alt text",
    path: ["coverAlt"],
  })
  .refine(
    (data) =>
      !data.updated || Date.parse(data.updated) >= Date.parse(data.date),
    {
      message: "Updated date cannot precede publication date",
      path: ["updated"],
    },
  );
export const draftInputSchema = z.object({
  metadata: metadataSchema,
  body: z.string().max(300_000),
  version: z.number().int().nonnegative().optional(),
});
export type Metadata = z.infer<typeof metadataSchema>;
export type DraftData = {
  metadata: Metadata;
  body: string;
  format: "md" | "mdx";
  source?: string;
  publishedCommit?: string;
  publishedAt?: string;
  repositoryStatus?: "draft" | "published";
};
export type Draft = DraftData & {
  id: string;
  version: number;
  originPath: string | null;
  baseSha: string | null;
  createdAt: string;
  updatedAt: string;
};
export type DraftSummary = Pick<
  Draft,
  | "id"
  | "version"
  | "metadata"
  | "format"
  | "repositoryStatus"
  | "originPath"
  | "baseSha"
  | "createdAt"
  | "updatedAt"
>;
export function draftStatus(
  draft: Pick<Draft, "baseSha" | "repositoryStatus" | "metadata">,
) {
  if (!draft.baseSha) return "private draft";
  if (draft.repositoryStatus === "draft")
    return "repository draft + working copy";
  if (Date.parse(draft.metadata.date) > Date.now())
    return "scheduled + working copy";
  return "published + working copy";
}
export type RepositoryPost = {
  path: string;
  sha: string;
  title: string;
  description: string;
  slug: string;
  date: string;
  tags: string[];
  status: string;
  format: "md" | "mdx";
};

export function parseSource(source: string, filename: string) {
  const match = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("Article must start with YAML frontmatter.");
  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length)
    throw new Error(
      "Article frontmatter contains invalid or duplicate YAML keys.",
    );
  const raw = document.toJS({ maxAliasCount: 20 }) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Frontmatter must be a mapping.");
  const date =
    raw.date instanceof Date ? raw.date.toISOString() : String(raw.date ?? "");
  const metadata = metadataSchema.parse({
    ...raw,
    slug:
      raw.slug ??
      filename
        .split("/")
        .pop()
        ?.replace(/\.mdx?$/, ""),
    date,
    tags: raw.tags ?? [],
  });
  return {
    document,
    raw,
    metadata,
    body: source.slice(match[0].length),
    format: filename.endsWith(".mdx") ? ("mdx" as const) : ("md" as const),
  };
}

export function serializePost(
  data: DraftData,
  body = data.body,
  metadata = data.metadata,
) {
  // YAML's document API preserves unknown metadata and comments; MDX body is
  // retained byte-for-byte. Never compile or execute private MDX on the server.
  if (data.source) {
    const parsed = parseSource(data.source, `post.${data.format}`);
    const keys = { ...metadata, status: "published" };
    Object.entries(keys).forEach(([key, value]) => {
      if (value !== undefined) parsed.document.set(key, value);
    });
    return `---\n${parsed.document.toString()}---\n${body}`;
  }
  return `---\n${stringify({ ...metadata, status: "published" })}---\n${body}`;
}

export const wordCount = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;
export const readingMinutes = (text: string) =>
  Math.max(1, Math.ceil(wordCount(text) / 220));
