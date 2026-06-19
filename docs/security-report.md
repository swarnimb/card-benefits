# Security Report: CardMaxxer

**Last audit:** 2026-06-18
**Scope:** Feature 12 — Shareable Static Demo (Phase L) milestone gate, including the read-only-modal change (commits `d229199`, `1753720`). Public GitHub Pages demo surface + the demo/auth/write-path code it exercises. Previous: 2026-06-17 (Feature 11), 2026-06-12 (pre-public sweep, Task 92), 2026-06-09 (Feature 10). Prior reports retained in git history.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 1 Medium / 2 Low

**Unresolved Critical/High findings:** None.

---

## Verdict

CLEAR — no Critical or High findings. Feature 12 (the public demo) and the new
read-only modal introduce **no new vulnerabilities**. The repo remains safe to be
public: no live secrets in tracked files, demo fixtures, the static export, or git
history. CONSTRAINT-28 (demo is read-only, no persisted mutation) is verified
enforced. Both carried items remain correctly defended/bounded.

---

## Checks performed (all PASS)

**Secret / sensitive-data exposure (SEC-01, SEC-05, SEC-07)**
- No hardcoded credentials in `src/` — all hits are `process.env.*` reads or test fixtures.
- Only `NEXT_PUBLIC_` var is `NEXT_PUBLIC_DEMO_MODE` (a boolean build flag) — safe to inline in the client bundle.
- `public/demo-fixtures/*.json` + `scripts/generate-demo-fixtures.ts` are fully fictional — no real emails, card numbers, account IDs, or PII.
- `.gitignore` covers every SEC-07 file (`.env`, `.env*.local`, `docs/testing-setup.md`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`).
- Git history is clean — no `.env`/session/handoff/config file ever committed. Working tree clean.

**Demo read-only enforcement & access control (CONSTRAINT-28, SEC-04)**
- No mutating request escapes `apiFetch` — zero raw `fetch("/api`/`XMLHttpRequest`/`axios`/`sendBeacon`/`WebSocket` call sites. Every write goes through the demo gate.
- `demoWrite` serves interactive no-ops (usage / tracked / activation / scrape) as in-memory `Response`s and blocks all other writes with a 403 + read-only modal. Nothing persists — there is no server in the static export.
- New code clean: both GitHub links use `rel="noopener noreferrer"` (no tabnabbing); `demoRepoUrl` href is a hardcoded constant (no injection); no `dangerouslySetInnerHTML`; all dynamic text is React-escaped (no XSS).
- Mass assignment defended — `createBenefitWithPeriod`, `POST /api/benefits`, and `PATCH /api/benefits/[id]` all use explicit field allowlists; `source`/`classification`/`userCardId`/`setAndForget` are server-set, never spread from the request body.
- Auth gating sound — auth is skipped only under build-time `isDemoMode`; the prod build inlines it to `false`, runs `auth()` + `redirect("/login")`, and every API route independently calls `requireAuth()` (defense in depth).

**Dependencies & deploy configuration**
- `npm audit`: 0 Critical / 2 High / 9 Moderate / 2 Low. The 2 High (`hono`, `undici`) and all moderates are dev-tooling or server-runtime deps (via `@prisma/dev`, build tooling) — **none reach the static demo client bundle**. Informational for the public demo.
- `deploy-demo.yml` stashes `src/app/api` before the static build (no API routes deployed), injects no secrets (only `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`), and uses minimal token permissions (`contents:read`, `pages:write`, `id-token:write`).
- `next.config.ts` demo branch is clean (no source maps, no debug). The demo needs no secrets (fixtures only, no Anthropic API / DB at runtime).

---

## Findings (non-blocking)

### MEDIUM — Carried dependency advisories (dev/build/server-runtime only)
**Rule:** Insecure dependencies (CVE) — vulnerability category, not a SEC rule violation.
**What is wrong:** `npm audit` reports 2 High (`hono` GHSA-88fw-hqm2-52qc CORS; `undici` GHSA-vmh5-mc38-953g TLS-bypass) + moderates (`next`→`postcss`, `esbuild`/`vite`/`vitest` dev-server).
**Why non-blocking:** All are dev-tooling or server-runtime deps **excluded from the static export** — they never ship to demo visitors. Real-world relevance is limited to the local dev/scrape machine, which is single-user desktop with no exposed Hono server or SOCKS5 proxy use.
**Fix (optional):** semver-major bumps of `prisma`/`undici`/`hono` would clear the local-dev advisories. Track; not required to ship the demo.

### LOW — Single-admin `getUserId()` IDOR (prod-only, bounded, unreachable in demo)
**Rule:** SEC-04 (resource-level authorization).
**What is wrong:** `getUserId()` returns a single hardcoded `ADMIN_USER_ID`; ownership checks compare against this one constant. A multi-user deployment would need per-user authorization.
**Why non-blocking:** With one user there is no second account to target, so impact is inherently bounded. Not reachable in the public demo at all — the API layer is physically removed before the static build. Must be fixed before any multi-user release.

### LOW (Info) — Personal email in git commit metadata
**What is wrong:** The committer email on the repo's commit history is a personal Gmail address (public on any public repo).
**Why non-blocking:** Previously reviewed and accepted. The email alone grants nothing (app is local-only; no credential exposure). For future commits, a GitHub `noreply` email avoids further metadata exposure; history rewrite is not warranted.
