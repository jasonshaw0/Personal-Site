# Private website administration

Production: **https://admin.jason-shaw.com**. Sign in with **jj@mountmyfish.com** through Cloudflare Access. There is no custom password or registration system.

This application has its own Vite frontend, Worker, D1 database, hostname, Access application, and Cloudflare build trigger. It shares the public site's fonts, palette tokens, and article CSS. Deploying it does not deploy the portfolio or contact service. Public content still builds through the existing `jasonshaw` Worker pipeline.

## Writing and publishing

1. Open **Blog & writing → New article**. Write Markdown and edit the article details. Changes autosave privately after one second; **Save draft** or **Ctrl/Cmd+S** saves immediately. Invalid metadata and version conflicts remain visible, and unsaved edits prevent accidental navigation or tab closing.
2. Preview in split mode, preview mode, or the reading dialog. The preview uses the public article CSS, sanitizes HTML, and runs in an iframe with scripts disabled. CodeMirror supports undo/redo, Markdown and fenced-code highlighting, Ctrl/Cmd+B/I/K, image selection, paste, and drag-and-drop. Fullscreen editing closes with Escape. Mobile provides write/preview modes.
3. Images upload privately to D1. PNG, JPEG, GIF, and WebP are supported, up to 1 MiB each. Cover images require alt text. Referenced uploads are rewritten to `/blog/images/<id>.<extension>` when published, and their bytes enter the same Git commit as the article. At most 20 upload references can be processed per publication. Published assets are retained to avoid breaking links; unused private images can be deleted.
4. **Publish → Publish to GitHub** writes to `jasonshaw0/Personal-Site`, branch `main`. Existing files retain their repository path; the frontmatter slug determines the public URL. New files use `blog/content/<slug>.md`. Duplicate slugs and changed GitHub baselines are rejected. The branch advances without force, so concurrent repository edits cannot be overwritten.
5. A successful commit is **not** confirmation that the page is live. **Overview → Latest deployments** shows production build outcomes and commit hashes. A failed build leaves the previous public deployment serving; correct the article and publish again. Future publication dates require a successful build after that UTC date; there is no scheduler.
6. **Unpublish** removes the article from GitHub and keeps its D1 working copy. **Delete** removes the working copy and, when present, its repository file after confirmation. Git history still retains previous public versions. Neither action can retract content already shared or committed publicly.

Repository articles are imported into private working copies before editing. An imported repository draft already exists in the public repository; the archive warns about that distinction. MDX bodies are read-only and retained byte-for-byte while metadata and unknown YAML fields/comments are preserved. Preview never executes MDX imports or components. Use **Published revisions → Restore** to load an earlier public version into the private copy, then review and publish it.

If a tab reports a version conflict, export a Markdown backup before reloading. **Reload latest from GitHub** replaces private changes with the current repository revision. For an interrupted publishing lock, **Recover interrupted operation** releases it only after 15 minutes; export edits and reconcile the GitHub revision before republishing. A lost branch-update response is checked against GitHub, and synchronization errors identify an accepted commit rather than claiming nothing changed.

## Analytics and security

All reporting comes from live Cloudflare APIs. No sample production numbers or additional visitor identifiers are used.

| Metric | Meaning |
| --- | --- |
| Browser page views | Web Analytics beacon page loads for the existing site tag |
| Visits | Page loads arriving from a different referring host; not unique people |
| Unique people | Unavailable; shown explicitly |
| HTTP requests | All zone requests, including assets, automation, errors, and redirects |
| Daily unique IPs | Separate edge observations; never added together as visitor totals |
| Bot flag | Cloudflare's browser-beacon classification, not all bot traffic |
| Security charts | Counts among at most 500 returned security events, not zone-wide totals |

Analytics supports UTC date ranges, previous-period comparisons, page/blog paths, referrers, geography, devices, browsers, response statuses, and reported sampling intervals. Dataset capabilities and retention are fetched live. The current zone permits individual firewall events but denies the grouped firewall dataset; the interface states the resulting chart limit. Security events support action/country filters. Missing or unavailable data is explained instead of replaced with another metric.

**Managed IP blocks** uses only the dedicated account list `jasonshaw_admin_blocked_ips`. Its rule is:

```text
(http.host in {"jason-shaw.com" "www.jason-shaw.com"} and ip.src in $jasonshaw_admin_blocked_ips)
```

The Worker checks the live rule ID, action, enabled state, and exact expression before changing the list. A changed rule stops mutations. Admin and contact hostnames are excluded; the current administrative IP cannot be added. Only individual public unicast IPv4/IPv6 addresses are accepted, with IPv6 normalization and duplicate checks. Confirmation is required, asynchronous list operations are polled, and accepted changes are distinguished from completed operations. The application cannot edit general WAF rules. Other lists and rules remain separate.

Administrative changes are logged privately in D1. **Activity log** searches and exports the latest 200 actions; records are retained in the database. Security API events may include request IPs; Web Analytics does not expose visitor IPs through this application.

## Authentication and credentials

Cloudflare Access is the first gate. The Worker independently verifies the `Cf-Access-Jwt-Assertion` RS256 signature, issuer, audience, expiration, required claims, allowed email, and exact application origin **for API and static asset requests**. JWKS are cached by the issuer. `workers.dev` and version preview URLs are disabled. Mutations require an exact Origin and a session-bound CSRF header. JSON bodies, media signatures, publishing paths, confirmation strings, and optimistic versions are validated. APIs are rate limited, and responses use no-store, noindex, frame restrictions, and a restrictive content policy. WebAssembly is permitted for syntax highlighting; arbitrary JavaScript evaluation is not.

Cloudflare's existing automatic beacon may be injected zone-wide. The admin CSP blocks it; the admin frontend neither includes nor permits an analytics beacon. The current Web Analytics rule allowance does not permit an additional exclusion rule. Public Web Analytics remains unchanged.

Privileged values exist only as Worker secrets, never in Vite variables or browser responses:

| Secret | Required scope | Current rotation date |
| --- | --- | --- |
| `GITHUB_TOKEN` | Fine-grained PAT: only `Personal-Site`, Contents read/write, Metadata read | Expires January 14, 2027 |
| `CF_ANALYTICS_TOKEN` | Account Analytics Read and Workers CI Read on the configured account; Analytics Read, Firewall Services Read, Zone WAF Read, and Zone Read on this zone | Expires October 16, 2027, New York time |
| `CF_SECURITY_TOKEN` | Account Rule Lists Write on the configured account | Expires October 16, 2027, New York time |

Cloudflare scopes list permissions at account level; the Worker fixes all list calls to the dedicated list ID. The security token has no WAF-edit or deployment permission. Runtime tokens are separate from the Cloudflare Builds deployment credential.

To rotate a credential, create a replacement with the same restricted permissions, run `npx wrangler secret put <NAME> --config admin/wrangler.jsonc`, verify **Settings → Recheck connections**, then revoke the previous token. Never paste values into source or logs. For local work, copy `.dev.vars.example` to `.dev.vars`; both local secret files and deployment artifacts are Git-ignored. Changing the authorized email requires updating both the Access allow policy and `ADMIN_EMAIL`, followed by deployment.

## Development and deployment

Use the Node version required by the root package. From the repository root:

```sh
npm ci
npm run check:admin
npm run test:admin
npm run build:admin
npm run deploy:admin
```

`admin/wrangler.jsonc` contains the existing D1/list/rule identifiers and non-secret bindings. `npm run types:admin` regenerates environment types. D1 schema migrations live in `admin/migrations`; use `npx wrangler d1 migrations apply DB --remote --config admin/wrangler.jsonc` for a new migration, and back up private data before schema/data changes. Initial production tables have already been provisioned.

The **Deploy private administration** Cloudflare build trigger tracks `main` for `admin/**`, shared article CSS/tokens, dependency files, and the root TypeScript config. It runs admin type checks/tests and `npx wrangler deploy --config admin/wrangler.jsonc`. The public site's existing trigger remains separate. Both reuse the existing GitHub repository connection and Cloudflare Builds deployment credential; runtime secrets are not build variables.

`npm run dev:admin` runs the Vite UI on port 5176 and proxies `/api` to port 8791. Run a local Worker/D1 instance separately, using an isolated config with local origin, local database persistence, and a local issuer/JWKS for signed test JWTs. There is no authentication bypass flag. Production config never accepts the local issuer. Local acceptance fixtures and signing material belong in the ignored `artifacts/` directory, not the repository or production database.

The Node tests verify signed JWT denial cases, CSRF, D1 version conflicts and operation locking, Git branch conflict/atomic commit behavior, media publication, MDX preservation, IP self-protection/rule scope, bounded bodies, and preview sanitization. Browser acceptance uses **Playwriter exclusively**. Use local D1 for disposable drafts and image tests, and an isolated Git branch for real publishing checks. Do not publish fabricated articles or block production addresses as a test.

Application limits: 500 repository articles, 1,000 listed private drafts, 500 stored uploads, 300,000 Markdown characters, and 20 referenced uploads per publication. Published source remains trusted author content in the public build; the private preview sanitizes it independently.
