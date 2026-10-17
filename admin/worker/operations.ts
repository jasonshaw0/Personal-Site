import { ApiError } from "./http.ts";
import { audit } from "./store.ts";
export async function operation<T>(
  request: Request,
  db: D1Database,
  actor: string,
  kind: string,
  target: string,
  action: () => Promise<T>,
) {
  const id = request.headers.get("Idempotency-Key");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id))
    throw new ApiError(400, "A valid operation key is required.");
  const prior = await db
    .prepare("SELECT * FROM operations WHERE id=?")
    .bind(id)
    .first<{
      actor: string;
      kind: string;
      target: string;
      state: string;
      result: string;
    }>();
  if (prior) {
    if (prior.actor !== actor || prior.kind !== kind || prior.target !== target)
      throw new ApiError(409, "Operation key was already used.");
    if (prior.state === "completed") return JSON.parse(prior.result) as T;
    throw new ApiError(
      409,
      "This operation is pending or has already failed. Refresh its status before retrying.",
      "operation_pending",
    );
  }
  try {
    await db
      .prepare(
        "INSERT INTO operations (id,kind,target,actor,state,created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(id, kind, target, actor, "pending", new Date().toISOString())
      .run();
  } catch {
    throw new ApiError(
      409,
      "Another operation is already changing this item. Wait for it to finish.",
      "operation_pending",
    );
  }
  try {
    const result = await action();
    await db
      .prepare("UPDATE operations SET state='completed',result=? WHERE id=?")
      .bind(JSON.stringify(result), id)
      .run();
    const detail =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};
    await audit(
      db,
      actor,
      kind,
      target,
      "success",
      JSON.stringify({
        operationId: id,
        commit: detail.commit,
        deleted: detail.deleted,
        cloudflareOperation: detail.operationId,
      }),
    );
    return result;
  } catch (error) {
    await db
      .prepare("UPDATE operations SET state='failed',result=? WHERE id=?")
      .bind(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Operation failed",
        }),
        id,
      )
      .run();
    await audit(
      db,
      actor,
      kind,
      target,
      "failed",
      error instanceof Error ? error.message : "Operation failed",
    );
    throw error;
  }
}
export async function assertDraftIdle(db: D1Database, id: string) {
  const busy = await db
    .prepare(
      "SELECT id FROM operations WHERE kind='content' AND target=? AND state='pending'",
    )
    .bind(id)
    .first();
  if (busy)
    throw new ApiError(
      409,
      "A publishing operation is changing this draft. Wait for it to finish.",
      "operation_pending",
    );
}
