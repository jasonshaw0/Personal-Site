import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { verifyIdentity, verifyMutation } from "./auth.ts";
import {
  metadataSchema,
  parseSource,
  serializePost,
  type DraftData,
  draftStatus,
} from "../shared/content.ts";
import { createDraft, saveDraft, getDraft, listDrafts } from "./store.ts";
import { operation, assertDraftIdle } from "./operations.ts";
import { GitHub } from "./github.ts";
import {
  Cloudflare,
  normalizeIP,
  validateRange,
  type CloudflareConfig,
} from "./cloudflare.ts";
import { preparePublication, validateImage } from "./media.ts";
import { readJson } from "./http.ts";
import { renderMarkdown } from "../src/preview-renderer.ts";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0001_admin.sql", import.meta.url),
      "utf8",
    ),
  );
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        args = values;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...(args as never[])) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...(args as never[])) };
      },
      async run() {
        return { meta: sqlite.prepare(sql).run(...(args as never[])) };
      },
    };
  };
  return { db: { prepare } as unknown as D1Database, sqlite };
}
const metadata = metadataSchema.parse({
  title: "A real draft",
  description: "Private work in progress.",
  slug: "real-draft",
  date: "2026-10-16",
  tags: ["Engineering"],
});
const data: DraftData = {
  metadata,
  body: "## Notes\n\nPrivate content.",
  format: "md",
};
const auth = {
  APP_ORIGIN: "https://admin.example.test",
  ACCESS_TEAM_DOMAIN: "https://team.example.test",
  ACCESS_AUD: "admin-audience",
  ADMIN_EMAIL: "owner@example.test",
};
const { privateKey, publicKey } = await generateKeyPair("RS256"),
  jwk = await exportJWK(publicKey);
jwk.kid = "test-key";
const resolver = createLocalJWKSet({ keys: [jwk] });
const token = (claims: Record<string, unknown> = {}) =>
  new SignJWT({ email: auth.ADMIN_EMAIL, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(auth.ACCESS_TEAM_DOMAIN)
    .setAudience(auth.ACCESS_AUD)
    .setSubject("user-id")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(privateKey);
test("Access verifies a signed owner JWT and derives a session-bound CSRF token", async () => {
  const signed = await token(),
    identity = await verifyIdentity(
      new Request(auth.APP_ORIGIN, {
        headers: { "Cf-Access-Jwt-Assertion": signed },
      }),
      auth,
      resolver,
    );
  assert.equal(identity.email, auth.ADMIN_EMAIL);
  assert.equal(identity.csrf.length, 43);
});
test("Access denies missing, forged, expired, wrong-identity, audience, issuer and alternate-host requests", async () => {
  await assert.rejects(
    verifyIdentity(new Request(auth.APP_ORIGIN), auth, resolver),
    /Sign in/,
  );
  const valid = await token();
  for (const [signed, config, url] of [
    [valid, { ...auth, ACCESS_AUD: "other" }, auth.APP_ORIGIN],
    [
      valid,
      { ...auth, ACCESS_TEAM_DOMAIN: "https://wrong.test" },
      auth.APP_ORIGIN,
    ],
    [await token({ email: "someone@example.test" }), auth, auth.APP_ORIGIN],
    [valid, auth, "https://worker.workers.dev"],
    [valid.slice(0, -8) + "forgedXX", auth, auth.APP_ORIGIN],
    [
      await new SignJWT({ email: auth.ADMIN_EMAIL })
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(auth.ACCESS_TEAM_DOMAIN)
        .setAudience(auth.ACCESS_AUD)
        .setSubject("user-id")
        .setIssuedAt()
        .setExpirationTime(1)
        .sign(privateKey),
      auth,
      auth.APP_ORIGIN,
    ],
  ] as const)
    await assert.rejects(
      verifyIdentity(
        new Request(url, { headers: { "Cf-Access-Jwt-Assertion": signed } }),
        config,
        resolver,
      ),
    );
});
test("CSRF requires both same origin and the matching session token", () => {
  const identity = { email: auth.ADMIN_EMAIL, sub: "id", csrf: "correct" };
  const request = (origin: string, csrf: string, site = "same-origin") =>
    new Request(auth.APP_ORIGIN, {
      method: "POST",
      headers: { Origin: origin, "X-CSRF-Token": csrf, "Sec-Fetch-Site": site },
    });
  verifyMutation(request(auth.APP_ORIGIN, "correct"), auth, identity);
  for (const value of [
    request("https://evil.test", "correct"),
    request(auth.APP_ORIGIN, "wrong"),
    request(auth.APP_ORIGIN, "correct", "cross-site"),
  ])
    assert.throws(() => verifyMutation(value, auth, identity));
});
test("YAML comments, unknown metadata and MDX source survive metadata publishing", () => {
  const body =
    '\nimport Diagram from "./Diagram"\r\n\n<Diagram value={{ exact: true }} />\r\n';
  const source = `---\n# Keep this comment\ntitle: Original\ndescription: A detailed description\ndate: 2026-10-16\nslug: original\ncustom: preserve-me\n---\n${body}`;
  const parsed = parseSource(source, "original.mdx");
  const saved = serializePost({
    ...parsed,
    source,
    metadata: { ...parsed.metadata, title: "Edited" },
  });
  assert.equal(parseSource(saved, "original.mdx").body, body);
  assert.match(saved, /custom: preserve-me/);
  assert.match(saved, /# Keep this comment/);
  assert.match(saved, /status: published/);
  assert.throws(() =>
    parseSource(
      source.replace("title: Original", "title: Original\ntitle: Duplicate"),
      "post.md",
    ),
  );
});
test("metadata rejects unsafe slugs, image URLs, missing alt text and invalid dates", () => {
  for (const invalid of [
    { slug: "../../escape" },
    { slug: "index" },
    { cover: "javascript:alert(1)", coverAlt: "x" },
    { cover: "//external.test/image" },
    { cover: "https://example.test/image", coverAlt: "" },
    { date: "invalid" },
  ])
    assert.equal(
      metadataSchema.safeParse({ ...metadata, ...invalid }).success,
      false,
    );
});
test("D1 compare-and-swap retains the newer copy and rejects a stale tab", async () => {
  const { db, sqlite } = database();
  try {
    const draft = await createDraft(db, data);
    const saved = await saveDraft(
      db,
      { ...draft, body: "Newer content" },
      draft.version,
    );
    assert.equal(saved.version, 2);
    await assert.rejects(
      saveDraft(db, { ...draft, body: "Stale content" }, draft.version),
      /another tab/,
    );
    assert.equal((await getDraft(db, draft.id)).body, "Newer content");
  } finally {
    sqlite.close();
  }
});
test("operation keys replay results and concurrent operations cannot change the same draft", async () => {
  const { db, sqlite } = database();
  try {
    const key = crypto.randomUUID(),
      request = new Request(auth.APP_ORIGIN, {
        headers: { "Idempotency-Key": key },
      });
    let calls = 0;
    const result = await operation(
      request,
      db,
      "owner",
      "content",
      "draft",
      async () => {
        calls++;
        await assert.rejects(assertDraftIdle(db, "draft"), /publishing/);
        return { commit: "abc" };
      },
    );
    assert.deepEqual(
      await operation(request, db, "owner", "content", "draft", async () => {
        throw Error("must not run");
      }),
      result,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      operation(request, db, "other", "content", "draft", async () => ({})),
      /already used/,
    );
    await assertDraftIdle(db, "draft");
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM audit").get()?.n, 1);
  } finally {
    sqlite.close();
  }
});
test("publication includes referenced media atomically and leaves the private copy untouched", async () => {
  const { db, sqlite } = database();
  try {
    const id = crypto.randomUUID(),
      png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=";
    validateImage("image/png", png);
    sqlite
      .prepare(
        "INSERT INTO media(id,name,mime,content,size,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(id, "test.png", "image/png", png, 68, new Date().toISOString());
    const draft = await createDraft(db, {
      ...data,
      body: `![Diagram](/api/media/${id})`,
    });
    const result = await preparePublication(db, draft);
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0].isNew, true);
    assert.match(result.source, new RegExp(`/blog/images/${id}.png`));
    assert.match((await getDraft(db, draft.id)).body, /\/api\/media\//);
    await assert.rejects(
      preparePublication(db, { ...draft, format: "mdx" }),
      /preserve/,
    );
    assert.throws(() => validateImage("image/jpeg", png), /do not match/);
    assert.throws(() =>
      validateImage(
        "image/png",
        Buffer.from("<script>bad</script>").toString("base64"),
      ),
    );
  } finally {
    sqlite.close();
  }
});
const gitConfig = {
  GITHUB_OWNER: "owner",
  GITHUB_REPO: "repo",
  GITHUB_BRANCH: "main",
  GITHUB_TOKEN: "repository-only-test-token",
};
test("GitHub publication creates one tree/commit and advances the branch without force", async () => {
  const calls: {
    url: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];
  const github = new GitHub(gitConfig, async (input, init) => {
    const url = String(input),
      method = init?.method ?? "GET",
      body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url, method, body });
    const result = url.endsWith("/git/ref/heads/main")
      ? { object: { sha: "head" } }
      : url.includes("/git/trees/head?")
        ? { tree: [], truncated: false }
        : url.endsWith("/git/commits/head")
          ? { tree: { sha: "base-tree" } }
          : url.endsWith("/git/blobs")
            ? { sha: `blob-${calls.length}` }
            : { sha: "new-commit" };
    return Response.json(result);
  });
  const result = await github.commit(
    "Publish test",
    [
      { path: "blog/content/test.md", content: "article" },
      { path: "public/blog/images/test.png", base64: "aW1hZ2U=" },
    ],
    [{ path: "blog/content/test.md", sha: null }],
  );
  assert.equal(result.files.length, 2);
  assert.equal(
    calls.filter(
      (call) => call.url.endsWith("/git/trees") && call.method === "POST",
    ).length,
    1,
  );
  const update = calls.at(-1)!;
  assert.equal(update.method, "PATCH");
  assert.equal(update.body.force, false);
  assert.deepEqual(
    calls.find(
      (call) => call.url.endsWith("/git/commits") && call.method === "POST",
    )?.body.parents,
    ["head"],
  );
});
test("GitHub refuses stale baselines before writing any blob", async () => {
  let writes = 0;
  const github = new GitHub(gitConfig, async (input, init) => {
    if (init?.method !== "GET") writes++;
    return Response.json(
      String(input).includes("/git/ref/")
        ? { object: { sha: "head" } }
        : {
            tree: [
              { type: "blob", path: "blog/content/test.md", sha: "changed" },
            ],
            truncated: false,
          },
    );
  });
  await assert.rejects(
    github.commit(
      "Edit",
      [{ path: "blog/content/test.md", content: "stale" }],
      [{ path: "blog/content/test.md", sha: "old" }],
    ),
    /changed on GitHub/,
  );
  assert.equal(writes, 0);
});
const cfConfig: CloudflareConfig = {
  CF_ACCOUNT_ID: "account",
  CF_ZONE_ID: "zone",
  CF_SITE_TAG: "site",
  CF_PUBLIC_WORKER_TAG: "worker",
  CF_BLOCK_LIST_ID: "list",
  CF_BLOCK_RULESET_ID: "ruleset",
  CF_BLOCK_RULE_ID: "rule",
  CF_ANALYTICS_TOKEN: "read-only",
  CF_SECURITY_TOKEN: "list-only",
};
const expression =
  '(http.host in {"jason-shaw.com" "www.jason-shaw.com"} and ip.src in $jasonshaw_admin_blocked_ips)';
test("IP management checks live rule scope, normalizes IPv6 and uses only the list write token", async () => {
  const writes: unknown[] = [];
  const cf = new Cloudflare(cfConfig, async (input, init) => {
    const url = String(input),
      headers = new Headers(init?.headers);
    if (url.includes("/rulesets/")) {
      assert.equal(headers.get("Authorization"), "Bearer read-only");
      return Response.json({
        success: true,
        result: {
          rules: [{ id: "rule", action: "block", enabled: true, expression }],
        },
      });
    }
    assert.equal(headers.get("Authorization"), "Bearer list-only");
    if (init?.method === "GET") {
      assert.match(url, /per_page=50/);
      return Response.json({ success: true, result: [] });
    }
    writes.push(JSON.parse(String(init?.body)));
    return Response.json({
      success: true,
      result: { operation_id: "operation" },
    });
  });
  await assert.rejects(
    cf.changeBlock("8.8.8.8", "8.8.8.8", ""),
    /current administrative/,
  );
  const result = await cf.changeBlock(
    "2606:4700:4700:0:0:0:0:1111",
    "8.8.8.8",
    "Test",
  );
  assert.equal(result.ip, "2606:4700:4700::1111");
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], [
    { ip: "2606:4700:4700::1111", comment: "Test" },
  ]);
});
test("a widened or disabled WAF rule prevents every IP mutation", async () => {
  let writes = 0;
  const cf = new Cloudflare(cfConfig, async (_input, init) => {
    if (init?.method !== "GET") writes++;
    return Response.json({
      success: true,
      result: {
        rules: [
          {
            id: "rule",
            enabled: true,
            action: "block",
            expression: "ip.src in $jasonshaw_admin_blocked_ips",
          },
        ],
      },
    });
  });
  await assert.rejects(cf.changeBlock("8.8.8.8", "1.1.1.1", ""), /scope/);
  assert.equal(writes, 0);
});
test("IP and date validation reject ranges, private addresses, future and reversed periods", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "::1",
    "8.8.8.0/24",
    "fe80::1%eth0",
    "bad",
  ])
    assert.throws(() => normalizeIP(ip));
  assert.equal(normalizeIP("::ffff:8.8.8.8"), "8.8.8.8");
  assert.throws(() => validateRange("2030-01-01", "2030-01-02"));
  assert.throws(() => validateRange("2026-10-17", "2026-10-16"));
});
test("request body limits are enforced before JSON parsing", async () => {
  await assert.rejects(
    readJson(
      new Request(auth.APP_ORIGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"large":"0123456789"}',
      }),
      10,
    ),
    /large|limit/i,
  );
  await assert.rejects(
    readJson(new Request(auth.APP_ORIGIN, { method: "POST", body: "{}" })),
    /json/i,
  );
});
test("preview sanitizes executable HTML and highlights technical code", async () => {
  const html = await renderMarkdown(
    '# Safe\n\n<script>window.evil=true</script>\n<img src=x onerror="alert(1)">\n[bad](javascript:alert(1))\n\n```typescript\nconst answer = 42\n```',
  );
  assert.doesNotMatch(html, /<script|onerror|(?:href|src)="javascript:/i);
  assert.match(html, /shiki/);
  assert.match(html, /answer/);
});

test("working copies distinguish repository drafts, scheduled articles and published content", async () => {
  const { db, sqlite } = database();
  try {
    const privateDraft = await createDraft(db, data);
    assert.equal(draftStatus(privateDraft), "private draft");
    const tracked = {
      ...privateDraft,
      baseSha: "repository-sha",
      repositoryStatus: "draft" as const,
    };
    assert.equal(draftStatus(tracked), "repository draft + working copy");
    const published = {
      ...tracked,
      repositoryStatus: "published" as const,
      metadata: { ...metadata, date: "2020-01-01" },
    };
    assert.equal(draftStatus(published), "published + working copy");
    assert.equal(
      draftStatus({
        ...published,
        metadata: { ...metadata, date: "2099-01-01" },
      }),
      "scheduled + working copy",
    );
    const saved = await saveDraft(db, tracked, privateDraft.version);
    assert.equal(saved.repositoryStatus, "draft");
  } finally {
    sqlite.close();
  }
});

test("a lost GitHub branch-update response is reconciled before reporting failure", async () => {
  let advanced = false;
  const github = new GitHub(gitConfig, async (input, init) => {
    const url = String(input);
    if (init?.method === "PATCH") {
      advanced = true;
      throw new TypeError("Response lost");
    }
    if (url.endsWith("/git/ref/heads/main"))
      return Response.json({ object: { sha: advanced ? "accepted" : "head" } });
    if (url.includes("/git/trees/head?"))
      return Response.json({ tree: [], truncated: false });
    if (url.endsWith("/git/commits/head"))
      return Response.json({ tree: { sha: "tree" } });
    return Response.json({
      sha: url.endsWith("/git/commits") ? "accepted" : "blob",
    });
  });
  const result = await github.commit(
    "Publish",
    [{ path: "blog/content/post.md", content: "article" }],
    [{ path: "blog/content/post.md", sha: null }],
  );
  assert.equal(result.commit, "accepted");
});

test("archive summaries omit article bodies while individual drafts retain them", async () => {
  const { db, sqlite } = database();
  try {
    const draft = await createDraft(db, {
      ...data,
      body: "Private long-form source",
      source: "Original source",
    });
    const summaries = await listDrafts(db);
    assert.equal(summaries[0].metadata.title, metadata.title);
    assert.equal("body" in summaries[0], false);
    assert.equal("source" in summaries[0], false);
    assert.equal(
      (await getDraft(db, draft.id)).body,
      "Private long-form source",
    );
  } finally {
    sqlite.close();
  }
});
