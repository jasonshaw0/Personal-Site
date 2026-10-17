import type {
  Draft,
  DraftData,
  DraftSummary,
  Metadata,
} from "../shared/content.ts";
import { ApiError } from "./http.ts";
type DraftRow = {
  id: string;
  data: string;
  version: number;
  origin_path: string | null;
  base_sha: string | null;
  created_at: string;
  updated_at: string;
};
export const toDraft = (row: DraftRow): Draft => ({
  ...(JSON.parse(row.data) as DraftData),
  id: row.id,
  version: row.version,
  originPath: row.origin_path,
  baseSha: row.base_sha,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
export async function listDrafts(db: D1Database) {
  const rows = (
    await db
      .prepare(
        "SELECT id,version,origin_path,base_sha,created_at,updated_at,json_extract(data,'$.metadata') AS metadata,json_extract(data,'$.format') AS format,json_extract(data,'$.repositoryStatus') AS repository_status FROM drafts ORDER BY updated_at DESC LIMIT 1000",
      )
      .all<
        Omit<DraftRow, "data"> & {
          metadata: string;
          format: Draft["format"];
          repository_status: Draft["repositoryStatus"];
        }
      >()
  ).results;
  return rows.map(
    (row): DraftSummary => ({
      id: row.id,
      version: row.version,
      metadata: JSON.parse(row.metadata) as Metadata,
      format: row.format,
      repositoryStatus: row.repository_status,
      originPath: row.origin_path,
      baseSha: row.base_sha,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}
export async function getDraft(db: D1Database, id: string) {
  const row = await db
    .prepare("SELECT * FROM drafts WHERE id = ?")
    .bind(id)
    .first<DraftRow>();
  if (!row) throw new ApiError(404, "Draft not found.");
  return toDraft(row);
}
export async function createDraft(
  db: D1Database,
  data: DraftData,
  originPath: string | null = null,
  baseSha: string | null = null,
) {
  const total = await db
    .prepare("SELECT COUNT(*) AS count FROM drafts")
    .first<{ count: number }>();
  if ((total?.count ?? 0) >= 1000)
    throw new ApiError(
      422,
      "The private notebook has reached its 1,000-draft limit. Remove unused drafts first.",
    );
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  try {
    await db
      .prepare(
        "INSERT INTO drafts (id,data,origin_path,base_sha,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(id, JSON.stringify(data), originPath, baseSha, now, now)
      .run();
  } catch {
    throw new ApiError(
      409,
      "This article already has a private working copy. Refresh the list.",
      "conflict",
    );
  }
  return getDraft(db, id);
}
export async function saveDraft(db: D1Database, draft: Draft, version: number) {
  const result = await db
    .prepare(
      "UPDATE drafts SET data=?, origin_path=?, base_sha=?, version=version+1, updated_at=? WHERE id=? AND version=?",
    )
    .bind(
      JSON.stringify({
        metadata: draft.metadata,
        body: draft.body,
        format: draft.format,
        source: draft.source,
        publishedCommit: draft.publishedCommit,
        publishedAt: draft.publishedAt,
        repositoryStatus: draft.repositoryStatus,
      } satisfies DraftData),
      draft.originPath,
      draft.baseSha,
      new Date().toISOString(),
      draft.id,
      version,
    )
    .run();
  if (!result.meta.changes)
    throw new ApiError(
      409,
      "This draft changed in another tab. Reload the latest copy before saving.",
      "conflict",
    );
  return getDraft(db, draft.id);
}
export async function audit(
  db: D1Database,
  actor: string,
  action: string,
  target: string,
  outcome = "success",
  detail = "",
) {
  await db
    .prepare(
      "INSERT INTO audit (id,actor,action,target,outcome,detail,created_at) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      actor,
      action,
      target,
      outcome,
      detail.slice(0, 1000),
      new Date().toISOString(),
    )
    .run();
}
