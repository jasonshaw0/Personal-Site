import { z } from "zod";
import { ApiError } from "./http.ts";
import type { Draft } from "../shared/content.ts";
import { serializePost } from "../shared/content.ts";

export type MediaRow = {
  id: string;
  name: string;
  mime: string;
  content: string;
  size: number;
  public_path: string | null;
  created_at: string;
};
export const mediaInput = z.object({
  name: z.string().trim().min(1).max(160),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  content: z.string().max(1_400_000),
});
export function validateImage(mime: string, content: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content))
    throw new ApiError(400, "Invalid image encoding.");
  const bytes = Buffer.from(content, "base64");
  if (!bytes.length || bytes.length > 1_048_576)
    throw new ApiError(
      413,
      "Images must be 1 MiB or smaller. Use WebP or resize before uploading.",
    );
  const valid =
    mime === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/gif"
          ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
          : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid)
    throw new ApiError(400, "Image bytes do not match the selected file type.");
  return bytes;
}
export async function preparePublication(db: D1Database, draft: Draft) {
  const ids = new Set(
    [
      ...`${draft.body}\n${draft.metadata.cover}`.matchAll(
        /\/api\/media\/([a-f0-9-]{36})/gi,
      ),
    ].map((match) => match[1]),
  );
  if (ids.size > 20)
    throw new ApiError(
      422,
      "Publish at most 20 newly referenced uploads at once. Publish a smaller batch first.",
    );
  let body = draft.body,
    cover = draft.metadata.cover;
  const assets: { id: string; path: string; base64: string; isNew: boolean }[] =
    [];
  for (const id of ids) {
    const media = await db
      .prepare("SELECT * FROM media WHERE id=?")
      .bind(id)
      .first<MediaRow>();
    if (!media)
      throw new ApiError(
        422,
        "An image referenced by this draft is missing. Upload it again before publishing.",
      );
    const extension = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
    }[media.mime];
    if (!extension) throw new ApiError(422, "Unsupported uploaded media type.");
    const path = media.public_path ?? `/blog/images/${id}.${extension}`;
    if (draft.format === "mdx" && body.includes(`/api/media/${id}`))
      throw new ApiError(
        422,
        "MDX body transformations are disabled to preserve the original source.",
      );
    body = body.replaceAll(`/api/media/${id}`, path);
    cover = cover.replaceAll(`/api/media/${id}`, path);
    assets.push({ id, path, base64: media.content, isNew: !media.public_path });
  }
  const metadata = { ...draft.metadata, cover };
  return {
    source: serializePost(draft, body, metadata),
    body,
    metadata,
    assets,
  };
}
