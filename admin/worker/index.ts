import { z } from "zod";
import {
  draftInputSchema,
  parseSource,
  type DraftData,
} from "../shared/content.ts";
import { ApiError, json, readJson, secure } from "./http.ts";
import { verifyIdentity, verifyMutation, type Identity } from "./auth.ts";
import {
  audit,
  createDraft,
  getDraft,
  listDrafts,
  saveDraft,
} from "./store.ts";
import { GitHub, validateContentPath } from "./github.ts";
import { Cloudflare, normalizeIP } from "./cloudflare.ts";
import { assertDraftIdle, operation } from "./operations.ts";
import {
  mediaInput,
  preparePublication,
  validateImage,
  type MediaRow,
} from "./media.ts";

const confirm = (received: unknown, expected: string) => {
  if (received !== expected)
    throw new ApiError(400, "Explicit confirmation is required.");
};
const idFrom = (value: string) => z.string().uuid().parse(value);
const settingsError = (error: unknown) =>
  error instanceof Error ? error.message : "Integration unavailable";
const settle = async <T>(call: () => Promise<T>) => {
  try {
    return { available: true as const, data: await call() };
  } catch (error) {
    return { available: false as const, error: settingsError(error) };
  }
};

async function api(request: Request, env: AdminEnv, identity: Identity) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  const github = new GitHub(env),
    cloudflare = new Cloudflare(env);
  if (method === "GET" && path === "/api/session")
    return json({
      email: identity.email,
      csrf: identity.csrf,
      version: env.APP_VERSION,
      origin: env.APP_ORIGIN,
    });
  if (method === "GET" && path === "/api/posts") {
    const [drafts, repository] = await Promise.all([
      listDrafts(env.DB),
      settle(() => github.posts()),
    ]);
    return json({ drafts, repository });
  }
  if (method === "POST" && path === "/api/drafts") {
    const input = draftInputSchema.parse(await readJson(request));
    const draft = await createDraft(env.DB, { ...input, format: "md" });
    await audit(env.DB, identity.email, "draft.created", draft.id);
    return json(draft, 201);
  }
  if (method === "POST" && path === "/api/import") {
    const input = z.object({ path: z.string() }).parse(await readJson(request));
    validateContentPath(input.path);
    const existing = (await listDrafts(env.DB)).find(
      (draft) => draft.originPath === input.path,
    );
    if (existing) return json(await getDraft(env.DB, existing.id));
    const file = await github.file(input.path),
      parsed = parseSource(file.source, input.path);
    return json(
      await createDraft(
        env.DB,
        {
          metadata: parsed.metadata,
          body: parsed.body,
          format: parsed.format,
          source: file.source,
          repositoryStatus:
            parsed.raw.status === "published" ? "published" : "draft",
        },
        input.path,
        file.sha,
      ),
      201,
    );
  }
  const match = path.match(
    /^\/api\/drafts\/([^/]+)(?:\/(publish|unpublish|revisions|restore|reload|recover))?$/,
  );
  if (match) {
    const id = idFrom(match[1]),
      action = match[2],
      draft = await getDraft(env.DB, id);
    if (method === "GET" && !action) return json(draft);
    if (method === "POST" && action === "recover") {
      const input = z
        .object({ version: z.number().int(), confirmation: z.string() })
        .parse(await readJson(request));
      confirm(input.confirmation, `recover:${draft.metadata.slug}`);
      if (draft.version !== input.version)
        throw new ApiError(
          409,
          "This draft changed. Reload it before recovering.",
        );
      const pending = await env.DB.prepare(
        "SELECT created_at FROM operations WHERE kind='content' AND target=? AND state='pending'",
      )
        .bind(id)
        .first<{ created_at: string }>();
      const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
      if (pending && pending.created_at >= cutoff)
        throw new ApiError(
          409,
          "This operation is still within its 15-minute recovery window. Wait before recovering.",
        );
      await env.DB.prepare(
        "UPDATE operations SET state='failed',result=? WHERE kind='content' AND target=? AND state='pending' AND created_at<?",
      )
        .bind(
          JSON.stringify({
            error:
              "Interrupted operation released by owner; repository reconciliation required.",
          }),
          id,
          cutoff,
        )
        .run();
      await audit(env.DB, identity.email, "operation.recovered", id);
      return json(draft);
    }
    if (method === "PUT" && !action) {
      await assertDraftIdle(env.DB, id);
      const input = draftInputSchema.parse(await readJson(request));
      if (input.version === undefined)
        throw new ApiError(400, "Draft version is required.");
      if (draft.format === "mdx" && input.body !== draft.body)
        throw new ApiError(
          422,
          "MDX body editing is disabled. Its source will be preserved unchanged.",
        );
      return json(
        await saveDraft(
          env.DB,
          { ...draft, metadata: input.metadata, body: input.body },
          input.version,
        ),
      );
    }
    if (method === "GET" && action === "revisions")
      return json(
        draft.originPath ? await github.revisions(draft.originPath) : [],
      );
    if (method === "POST" && (action === "restore" || action === "reload")) {
      await assertDraftIdle(env.DB, id);
      const input = z
        .object({
          version: z.number().int(),
          revision: z
            .string()
            .regex(/^[a-f0-9]{40}$/)
            .optional(),
          confirmation: z.string(),
        })
        .parse(await readJson(request));
      confirm(input.confirmation, `${action}:${draft.metadata.slug}`);
      if (!draft.originPath)
        throw new ApiError(400, "This draft has no repository history.");
      if (action === "restore" && !input.revision)
        throw new ApiError(400, "Choose a revision to restore.");
      let file: Awaited<ReturnType<GitHub["file"]>>;
      try {
        file = await github.file(
          draft.originPath,
          action === "restore" ? input.revision : undefined,
        );
      } catch (error) {
        if (
          action !== "reload" ||
          !(error instanceof ApiError) ||
          error.status !== 404
        )
          throw error;
        // A missing file can be an accepted unpublish followed by a lost D1
        // write. Verify repository access before reconciling its absence.
        if (
          (await github.tree()).some((item) => item.path === draft.originPath)
        )
          throw error;
        const retained = await saveDraft(
          env.DB,
          {
            ...draft,
            baseSha: null,
            repositoryStatus: undefined,
            publishedCommit: undefined,
            publishedAt: undefined,
          },
          input.version,
        );
        await audit(env.DB, identity.email, "draft.reconciled_deleted", id);
        return json(retained);
      }
      const parsed = parseSource(file.source, draft.originPath);
      const result = await saveDraft(
        env.DB,
        {
          ...draft,
          metadata: parsed.metadata,
          body: parsed.body,
          source: file.source,
          baseSha: action === "reload" ? file.sha : draft.baseSha,
          repositoryStatus:
            action === "reload"
              ? parsed.raw.status === "published"
                ? "published"
                : "draft"
              : draft.repositoryStatus,
        },
        input.version,
      );
      await audit(
        env.DB,
        identity.email,
        `draft.${action}`,
        id,
        "success",
        input.revision,
      );
      return json(result);
    }
    if (
      (method === "POST" && (action === "publish" || action === "unpublish")) ||
      (method === "DELETE" && !action)
    ) {
      const operationName = action ?? "delete";
      const input = z
        .object({ version: z.number().int(), confirmation: z.string() })
        .parse(await readJson(request));
      confirm(input.confirmation, `${operationName}:${draft.metadata.slug}`);
      if (draft.version !== input.version)
        throw new ApiError(
          409,
          "The draft changed. Reload before continuing.",
          "conflict",
        );
      return json(
        await operation(
          request,
          env.DB,
          identity.email,
          "content",
          id,
          async () => {
            // Claim the exact version before issuing any external write.
            const claimed = await saveDraft(env.DB, draft, input.version);
            if (operationName === "publish") {
              const publication = await preparePublication(env.DB, claimed);
              const destination =
                claimed.originPath ??
                `blog/content/${claimed.metadata.slug}.${claimed.format}`;
              if (
                (await github.posts()).some(
                  (post) =>
                    post.path !== destination &&
                    post.slug === claimed.metadata.slug,
                )
              )
                throw new ApiError(
                  409,
                  "Another repository article already uses this slug. Choose a unique slug before publishing.",
                  "slug_conflict",
                );
              // Retain the destination even if a response or a subsequent D1 write
              // fails, so Reload latest can reconcile a newly created article.
              const prepared = await saveDraft(
                env.DB,
                { ...claimed, originPath: destination },
                claimed.version,
              );
              const changes = [
                { path: destination, content: publication.source },
                ...publication.assets
                  .filter((asset) => asset.isNew)
                  .map((asset) => ({
                    path: `public${asset.path}`,
                    base64: asset.base64,
                  })),
              ];
              const result = await github.commit(
                `Publish: ${claimed.metadata.title}`,
                changes,
                [{ path: destination, sha: claimed.baseSha }],
              );
              const sha = result.files.find(
                (file) => file.path === destination,
              )?.sha;
              if (!sha)
                throw new ApiError(
                  502,
                  `Commit ${result.commit} was created, but its article SHA was missing. Reload from GitHub.`,
                );
              try {
                for (const asset of publication.assets)
                  await env.DB.prepare(
                    "UPDATE media SET public_path=? WHERE id=?",
                  )
                    .bind(asset.path, asset.id)
                    .run();
                const sourceData: DraftData = {
                  ...prepared,
                  body: publication.body,
                  metadata: publication.metadata,
                  source: publication.source,
                  publishedCommit: result.commit,
                  publishedAt: new Date().toISOString(),
                  repositoryStatus: "published",
                };
                const saved = await saveDraft(
                  env.DB,
                  {
                    ...prepared,
                    ...sourceData,
                    originPath: destination,
                    baseSha: sha,
                  },
                  prepared.version,
                );
                return {
                  draft: saved,
                  commit: result.commit,
                  message:
                    "Committed to GitHub. Cloudflare deployment is pending; check deployment status before assuming the page is live.",
                };
              } catch {
                throw new ApiError(
                  502,
                  `GitHub accepted commit ${result.commit}, but private state could not be synchronized. Export your edits, then Reload latest from GitHub before publishing again.`,
                  "reconciliation_required",
                );
              }
            }
            let commit: string | null = null;
            if (claimed.originPath && claimed.baseSha) {
              const result = await github.commit(
                `${operationName === "delete" ? "Delete" : "Unpublish"}: ${claimed.metadata.title}`,
                [{ path: claimed.originPath, remove: true }],
                [{ path: claimed.originPath, sha: claimed.baseSha }],
              );
              commit = result.commit;
            }
            try {
              if (operationName === "delete") {
                await env.DB.prepare(
                  "DELETE FROM drafts WHERE id=? AND version=?",
                )
                  .bind(id, claimed.version)
                  .run();
                return {
                  deleted: true,
                  commit,
                  message: commit
                    ? "Article removed from GitHub. Await Cloudflare deployment."
                    : "Private draft deleted.",
                };
              }
              const saved = await saveDraft(
                env.DB,
                {
                  ...claimed,
                  baseSha: null,
                  publishedCommit: undefined,
                  publishedAt: undefined,
                  repositoryStatus: undefined,
                },
                claimed.version,
              );
              return {
                draft: saved,
                commit,
                message: commit
                  ? "Unpublished in GitHub. The private working copy is retained. Await Cloudflare deployment."
                  : "This draft is already private.",
              };
            } catch (error) {
              if (commit)
                throw new ApiError(
                  502,
                  `GitHub accepted removal commit ${commit}, but private state could not be synchronized. Reload latest from GitHub to reconcile the retained working copy.`,
                  "reconciliation_required",
                );
              throw error;
            }
          },
        ),
      );
    }
  }
  if (method === "GET" && path === "/api/media") {
    const rows = (
      await env.DB.prepare(
        "SELECT id,name,mime,size,public_path,created_at FROM media ORDER BY created_at DESC LIMIT 500",
      ).all()
    ).results;
    return json(rows);
  }
  if (method === "POST" && path === "/api/media") {
    const input = mediaInput.parse(await readJson(request, 1_500_000)),
      bytes = validateImage(input.mime, input.content),
      id = crypto.randomUUID();
    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM media",
    ).first<{ count: number }>();
    if ((total?.count ?? 0) >= 500)
      throw new ApiError(
        422,
        "Media library has reached its 500-image limit. Remove unused images first.",
      );
    await env.DB.prepare(
      "INSERT INTO media (id,name,mime,content,size,created_at) VALUES (?,?,?,?,?,?)",
    )
      .bind(
        id,
        input.name,
        input.mime,
        input.content,
        bytes.length,
        new Date().toISOString(),
      )
      .run();
    await audit(env.DB, identity.email, "media.uploaded", id);
    return json(
      { id, url: `/api/media/${id}`, name: input.name, size: bytes.length },
      201,
    );
  }
  const mediaMatch = path.match(/^\/api\/media\/([^/]+)$/);
  if (mediaMatch) {
    const id = idFrom(mediaMatch[1]),
      row = await env.DB.prepare("SELECT * FROM media WHERE id=?")
        .bind(id)
        .first<MediaRow>();
    if (!row) throw new ApiError(404, "Image not found.");
    if (method === "GET")
      return new Response(Buffer.from(row.content, "base64"), {
        headers: {
          "Content-Type": row.mime,
          "Cache-Control": "no-store",
          "Content-Disposition": `inline; filename="${id}"`,
        },
      });
    if (method === "DELETE") {
      const input = z
        .object({ confirmation: z.string() })
        .parse(await readJson(request));
      confirm(input.confirmation, `delete:${id}`);
      if (row.public_path)
        throw new ApiError(
          409,
          "This image has been published. Keep the public asset to avoid breaking existing articles or external links.",
        );
      if (
        await env.DB.prepare(
          "SELECT id FROM drafts WHERE instr(data,?)>0 LIMIT 1",
        )
          .bind(`/api/media/${id}`)
          .first()
      )
        throw new ApiError(
          409,
          "This image is referenced by a private draft. Remove the reference first.",
        );
      await env.DB.prepare("DELETE FROM media WHERE id=?").bind(id).run();
      await audit(env.DB, identity.email, "media.deleted", id);
      return json({ deleted: true });
    }
  }
  if (method === "GET" && path === "/api/analytics")
    return json(
      await cloudflare.analytics(
        url.searchParams.get("start") ?? "",
        url.searchParams.get("end") ?? "",
        url.searchParams.get("compare") === "true",
      ),
    );
  if (method === "GET" && path === "/api/security/events") {
    const action = z
      .enum([
        "block",
        "managed_challenge",
        "challenge",
        "js_challenge",
        "skip",
        "allow",
        "log",
      ])
      .optional()
      .parse(url.searchParams.get("action") || undefined);
    const country = z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .parse(url.searchParams.get("country") || undefined);
    return json(
      await cloudflare.events(
        url.searchParams.get("start") ?? "",
        url.searchParams.get("end") ?? "",
        action,
        country,
      ),
    );
  }
  if (method === "GET" && path === "/api/security/blocks")
    return json({
      blocks: await cloudflare.blocks(),
      currentIP: request.headers.get("CF-Connecting-IP") ?? "",
      ...(await cloudflare.blockRule()),
    });
  if (
    (method === "POST" || method === "DELETE") &&
    path === "/api/security/blocks"
  ) {
    const input = z
      .object({
        ip: z.string(),
        reason: z.string().trim().max(300).default(""),
        id: z
          .string()
          .regex(/^[a-f0-9]{32}$/i)
          .optional(),
        confirmation: z.string(),
      })
      .parse(await readJson(request));
    const ip = normalizeIP(input.ip);
    confirm(
      input.confirmation,
      `${method === "DELETE" ? "unblock" : "block"}:${ip}`,
    );
    if (method === "DELETE" && !input.id)
      throw new ApiError(400, "Choose the block to remove.");
    return json(
      await operation(
        request,
        env.DB,
        identity.email,
        "security",
        ip,
        () =>
          cloudflare.changeBlock(
            ip,
            request.headers.get("CF-Connecting-IP") ?? "",
            input.reason,
            method === "DELETE" ? input.id : undefined,
          ),
        method === "DELETE"
          ? "security.unblock.requested"
          : "security.block.requested",
      ),
    );
  }
  if (method === "GET" && path.startsWith("/api/security/operations/"))
    return json(await cloudflare.blockOperation(path.split("/").pop()!));
  if (method === "GET" && path === "/api/deployments")
    return json(await cloudflare.builds());
  if (method === "GET" && path === "/api/audit")
    return json(
      (
        await env.DB.prepare(
          "SELECT * FROM audit ORDER BY created_at DESC LIMIT 200",
        ).all()
      ).results,
    );
  if (method === "GET" && path === "/api/settings") {
    const [githubStatus, analytics, security, deployments] = await Promise.all([
      settle(async () => {
        const repo = await github.request<{
          full_name: string;
          permissions?: { push: boolean };
        }>("");
        return {
          repository: repo.full_name,
          canPush: repo.permissions?.push ?? null,
        };
      }),
      settle(() => cloudflare.capabilities()),
      settle(async () => ({
        blockCount: (await cloudflare.blocks()).length,
        ...(await cloudflare.blockRule()),
      })),
      settle(() => cloudflare.builds()),
    ]);
    return json({
      version: env.APP_VERSION,
      origin: env.APP_ORIGIN,
      email: identity.email,
      repository: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
      branch: env.GITHUB_BRANCH,
      publicSite: "https://www.jason-shaw.com",
      github: githubStatus,
      analytics,
      security,
      deployments,
      credentials: {
        github: Boolean(env.GITHUB_TOKEN),
        analytics: Boolean(env.CF_ANALYTICS_TOKEN),
        security: Boolean(env.CF_SECURITY_TOKEN),
      },
      limits: {
        imageBytes: 1_048_576,
        markdownCharacters: 300_000,
        articles: 500,
        draftList: 1000,
      },
      access: {
        audience: env.ACCESS_AUD,
        issuer: env.ACCESS_TEAM_DOMAIN,
        alternateHosts: "Denied; workers.dev and preview URLs disabled",
      },
    });
  }
  throw new ApiError(404, "Endpoint not found.");
}

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID();
    try {
      const identity = await verifyIdentity(request, env);
      if (!["GET", "HEAD", "POST", "PUT", "DELETE"].includes(request.method))
        throw new ApiError(405, "Method not allowed.");
      if (new URL(request.url).pathname.startsWith("/api/")) {
        if (!(await env.ADMIN_RATE_LIMIT.limit({ key: identity.sub })).success)
          throw new ApiError(
            429,
            "Too many requests. Please wait a minute before retrying.",
          );
        if (!["GET", "HEAD"].includes(request.method))
          verifyMutation(request, env, identity);
        return secure(await api(request, env, identity));
      }
      if (!["GET", "HEAD"].includes(request.method))
        throw new ApiError(405, "Method not allowed.");
      return secure(await env.ASSETS.fetch(request));
    } catch (error) {
      if (error instanceof z.ZodError)
        return secure(
          json(
            {
              error: error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("; "),
              code: "validation_failed",
              requestId,
            },
            400,
          ),
        );
      if (error instanceof ApiError)
        return secure(
          json(
            { error: error.message, code: error.code, requestId },
            error.status,
          ),
        );
      console.error(
        JSON.stringify({
          event: "admin.request_failed",
          requestId,
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.name : "Unknown",
        }),
      );
      return secure(
        json(
          {
            error:
              "The request failed. Private drafts are retained; refresh integration status before retrying a change.",
            code: "internal_error",
            requestId,
          },
          500,
        ),
      );
    }
  },
} satisfies ExportedHandler<AdminEnv>;
