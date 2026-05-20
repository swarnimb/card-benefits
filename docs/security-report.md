# Security Report: CardMaxxer

**Last audit:** 2026-05-19
**Scope:** Tasks 14–39 since the 2026-04-10 audit — Overview API + UI redesign, AddCardModal, BenefitReviewGate, classification + tracked policy, Path B backfill script, generic scraper rewrite (`fetch` fast path + Playwright fallback, `jsdom` + `@mozilla/readability`). Re-evaluation of LOW-1…LOW-10 from prior audit. SEC-07 git-history sweep since 2026-04-10. `npm audit` triage (28 advisories — 13 moderate, 15 high).
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 1 Medium / 7 Low

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** Tasks 14–39 (delta since 2026-04-10) + dependency audit
**Status:** CLEAR

---

### MEDIUM — `next@16.1.6` ships with 19 published advisories; fix is non-breaking

**Rule violated:** Insecure dependencies (CVE class — supplements SEC, not in rules file)

**Founder Brief**
**Decided:** Your installed Next.js version has 19 published security advisories. The fix is a patch release (`next@16.2.6`) that npm reports as non-breaking. Most advisories don't have an attack path on your MVP (you don't use middleware, rewrites, CSP nonces, WebSockets, or image optimization), but the fix is so cheap that running on a known-vulnerable framework is unjustified.
**Means for your product:** Today, low practical risk on a local-only single-user app. The exposed surface that *does* matter — cache poisoning in React Server Component responses (GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7) and HTTP request smuggling (GHSA-ggv3-7p47-pfv8) — has no realistic attacker in your threat model since the only client is you on `localhost`. But this becomes blocking for Phase 2 (Vercel multi-tenant).
**Check before approving:** After running `npm audit fix`, confirm `next` resolves to `16.2.6` or later in `package-lock.json`. Run the test suite — non-breaking should mean no regressions.
**What this closes off:** Nothing — patch-level update.

**What is wrong:** `package.json` line 24 pins `next: "16.1.6"`. `npm audit` reports 19 advisories against this version (16 High, 1 Moderate, plus the transitive `postcss` Moderate which is resolved by the same Next bump). The fix advisory says: `Will install next@16.2.6, which is outside the stated dependency range` — i.e., bumps the caret-pinned 16.1.6 to 16.2.6 — `npm audit fix` (not `--force`) will apply it.

**What could go wrong:** On a public deployment, the HTTP smuggling, RSC cache poisoning, and middleware-bypass advisories could enable cross-user request injection. On the current local-only deployment these are not exploitable — there is no proxy chain, no shared cache, no multi-user session pool. But the cost of carrying a vulnerable framework version is zero; the reason to fix is hygiene, not active risk.

**How to fix it:** `npm audit fix`. Verify `next` upgrades to `16.2.6` (non-breaking per npm). Re-run `npm audit` to confirm the count drops by ~17 advisories. Run `npm run test` and `npm run test:integration`.

---

### LOW-1 — RESOLVED — `customIssuer` / `customName` length constraints

Prior: file `src/app/api/user-cards/route.ts`. Now enforced at `resolveOrCreateCard()` line 54: `customIssuer.length > MAX_FIELD_LENGTH || customName.length > MAX_FIELD_LENGTH` returns 400 with `MAX_FIELD_LENGTH = 100`. ✓ Closed.

---

### LOW-2 — RESOLVED — `anniversaryDate` validation

Prior: file `src/app/api/user-cards/[id]/route.ts`. Now enforced at `buildUserCardUpdate()` line 32: `if (isNaN(parsed.getTime())) return "anniversaryDate must be a valid date or null"` — returns 400 before reaching Prisma. ✓ Closed.

---

### LOW-3 — Plaintext admin password (CONSTRAINT-14, carried forward)

**Rule violated:** SEC-06 (accepted exception per CONSTRAINT-14)

**Founder Brief**
**Decided:** `ADMIN_PASSWORD` is read as plaintext from `.env`. The framework rule says hashed; CardMaxxer accepts plaintext because `dotenv-expand` (used by Next.js) corrupts bcrypt hashes containing `$` and the app is local-only.
**Means for your product:** Negligible for MVP. The `.env` file is local-only, gitignored, and never leaves your machine. Anyone with filesystem access already has access to everything else (SQLite DB, scraped data) — so the password isn't a meaningful barrier in that threat model.
**Check before approving:** Confirm `.env` remains gitignored (verified — `.gitignore` line 9 covers `.env` and `.env*.local`). Confirm `.env` does not appear anywhere in `git log --all`.
**What this closes off:** Phase 2 (multi-user Vercel) must reintroduce hashed passwords with an auth provider — likely Postgres + NextAuth Credentials with bcrypt at module scope, not env-var-bound.

**What is wrong:** `src/lib/auth.ts` line 10 compares `password !== process.env.ADMIN_PASSWORD` directly. No hashing.

**What could go wrong:** On a multi-user or remote deployment, a `.env` exfiltration discloses the live password in cleartext. Not exploitable on local-only single-user MVP.

**How to fix it:** Documented as carried forward under CONSTRAINT-14. Must be revisited in Phase 2 — file blocker into Phase 2 prep checklist.

---

### LOW-4 — RESOLVED — `name`/`description` length in confirm route

Prior: file `src/app/api/benefits/confirm/route.ts`. Now enforced at `validateBenefits()` lines 21–24: `name` required string, length ≤ 200; `description` string-or-null, length ≤ 1000. Missing/invalid → 400. ✓ Closed.

---

### LOW-5 — RESOLVED — `value`/`tracked` type validation in confirm route

Prior: file `src/app/api/benefits/confirm/route.ts`. Now enforced at `validateBenefits()`:
- Line 26: `value` checked for `typeof === "number" && Number.isFinite && >= 0`.
- Line 31 (comment): `tracked` is **no longer read from the client** — it is server-derived from `classification` via `deriveTracked()` at line 49. Client-supplied `tracked` is silently ignored (consistent with Decision A applied to PATCH).
- Line 32: `classification` validated via `isValidClassification()` allowlist (the five buckets in `src/lib/parser/classification.ts`). Invalid → 400 with explicit error message.

Server is the sole authority for `tracked` ✓ — confirmed by reading `runConfirmTransaction()` line 49: `const tracked = deriveTracked(b.classification)`, ignoring `b.tracked`. ✓ Closed.

---

### LOW-6 — GET /api/user-cards/[id]/benefits exposes 404 vs 403 (carried forward, unchanged)

**Rule violated:** SEC-04 (resource enumeration via response discrimination)

**Founder Brief**
**Decided:** Probing the `[userCardId]` slug returns 404 for non-existent vs 403 for existing-but-owned-by-someone-else. Distinguishable response codes leak which IDs exist.
**Means for your product:** Negligible — single-user deployment, no other users to enumerate against.
**Check before approving:** Phase 2 must collapse to a uniform 404.
**What this closes off:** Phase 2 multi-user — collapse both branches to 404.

**What is wrong:** `src/app/api/user-cards/[id]/benefits/route.ts` lines 29–30 — distinct status codes.

**What could go wrong:** On multi-tenant, an attacker probes `cuid`s to discover valid resources owned by other users. Not exploitable here.

**How to fix it:** Phase 2 work — collapse to uniform 404.

---

### LOW-7 — RESOLVED — `name`/`description` length in PATCH benefit

Prior: file `src/app/api/benefits/[id]/route.ts`. Now enforced at `validatePatchFields()` lines 47–48: `name` non-empty string, ≤ 200; `description` string-or-null, ≤ 1000. ✓ Closed.

---

### LOW-8 — RESOLVED — `value`/`tracked` type validation in PATCH benefit (via Decision A)

Prior: file `src/app/api/benefits/[id]/route.ts`. Now resolved by **Decision A** (PRD 3.5 / CONSTRAINT-06):
- `value` validated at line 50: number, finite, ≥ 0.
- `tracked` and `classification` are explicitly excluded from `ALLOWED_PATCH_FIELDS` (lines 12–18). The `extractPatchFields()` allowlist at line 40 silently strips any client-supplied `tracked` or `classification` — they are not in the set, so they never reach Prisma. Verified by code comment: "intentionally absent here so extractPatchFields silently strips them rather than 400-ing." ✓ Closed.

---

### LOW-9 — Timing side channel in `authorizeUser()` (carried forward, unchanged)

**Rule violated:** SEC-04 / SEC-09 (timing leaks across observable channels)

**Founder Brief**
**Decided:** `authorizeUser()` short-circuits on email mismatch before checking the password. An attacker measuring response time can tell whether the email is the registered admin email.
**Means for your product:** Negligible — there is one admin email and the attacker would have to be on the local network. No realistic Phase-1 exposure.
**Check before approving:** Phase 2 must replace with a constant-time comparison and password-shaped dummy work on the email-mismatch branch.
**What this closes off:** Phase 2 multi-user — must address before Vercel migration.

**What is wrong:** `src/lib/auth.ts` lines 9–10 — early return on email mismatch skips the password check; response timing differentiates "wrong email" from "wrong password."

**What could go wrong:** Enumerate the admin email by timing probes. Not exploitable on local-only deployment.

**How to fix it:** Phase 2 — use a constant-time compare against a precomputed admin email digest and always run a dummy password compare (or replace with NextAuth Credentials over Postgres + bcrypt). Tracked under CONSTRAINT-14 follow-up.

---

### LOW-10 — POST /api/benefits/[id]/usage exposes 404 vs 403 (carried forward, unchanged)

**Rule violated:** SEC-04 (resource enumeration via response discrimination)

**Founder Brief**
**Decided:** Same pattern as LOW-6 — distinct 404 vs 403 on the usage POST.
**Means for your product:** Negligible on single-user deployment.
**Check before approving:** Phase 2 must collapse to uniform 404.
**What this closes off:** Phase 2 multi-user.

**What is wrong:** `src/app/api/benefits/[id]/usage/route.ts` lines 27–30 — distinct status codes.

**What could go wrong:** Same as LOW-6 — multi-tenant enumeration.

**How to fix it:** Phase 2 work.

---

## New findings (Tasks 14–39)

### Scraper SSRF surface — REVIEWED, NO FINDING

**Why no finding:** The new `genericScrape()` accepts a URL and dispatches `fetch()` + Playwright `goto()`. Tracing the call site:

- Only caller: `src/app/api/user-cards/[id]/scrape/route.ts` line 36 — `scrapeCard(userCard.card.issuer, userCard.card.scrapeUrl)`.
- `userCard.card.scrapeUrl` originates from `prisma.card.scrapeUrl`.
- Write sites for `Card.scrapeUrl` (`grep` confirmed exhaustive): `src/app/api/user-cards/route.ts` lines 36, 43, 61.
  - Line 36 (create): `scrapeUrl: entry.scrapeUrl` where `entry` is a catalog hit from `data/card-catalog.json` (developer-controlled).
  - Line 43 (update): same — `entry.scrapeUrl` from the catalog file. The catalog-vs-DB reconciliation only writes catalog values.
  - Line 61 (custom card): `scrapeUrl: null` — hardcoded. Then the scrape route short-circuits at line 30: `if (!userCard.card.scrapeUrl) return { benefits: [], scrapeError: CUSTOM_CARD_SCRAPE_ERROR }`.

There is no PATCH route for `Card` (and no admin UI surface) that exposes `scrapeUrl` to user input. **No user-supplied string can reach `fetch()` or `chromium.newPage().goto()`.** The scraper URL is dev-trusted via the committed catalog.

**Phase 2 caveat:** Add a finding here at Phase-2 kickoff if multi-user / custom-URL scraping is introduced — at that point, validate against an allowlist (`https://` only, no private-network resolution, no userinfo, no `file://`/`data:`/`javascript:`).

---

### `jsdom` + `@mozilla/readability` rendering surface — REVIEWED, NO FINDING

**Why no finding:** Untrusted HTML is parsed by `JSDOM` inside the scraper sandbox and `Readability.parse()` extracts `textContent`. The text result then:

1. Flows to `parseBenefits(rawText)` in `src/lib/parser/index.ts` — sent to Anthropic as a `user` message body. Anthropic-side rendering is not under app control and not at risk in this codebase.
2. Returns as `DraftBenefit[]` to the client (review gate).
3. Renders inside `BenefitReviewGate` via React text nodes (`<input value={...}>`, `<p>{name}</p>`, etc.).

`grep -r dangerouslySetInnerHTML src/` returns zero matches. React auto-escapes all text-node interpolation. The benefit `name`/`description` fields are length-checked at `validateBenefits()` (200 / 1000 chars) and stored in SQLite as strings — no HTML execution path.

`npm audit` shows zero advisories against `jsdom@29.1.1` or `@mozilla/readability@0.6.0`. Confirmed via `npm audit --json | grep -E "jsdom|readability"` — both clean.

---

### Classification allowlist — REVIEWED, NO FINDING

**Why no finding:** Confirm route validates `classification` against `isValidClassification()` (`src/lib/parser/classification.ts` line 34) which checks `CLASSIFICATION_BUCKETS` membership — a const-readonly array of the five known buckets. Invalid → 400 (`src/app/api/benefits/confirm/route.ts` line 32). At write time, `runConfirmTransaction()` calls `normalizeClassification()` (line 61) which re-runs the same validation and falls back to `"discretionary-credit"` if anything slipped through. No arbitrary-string path exists to the `classification` column. The user is permitted to override the LLM's bucket choice via the review gate (intended per CONSTRAINT-10), but only to a valid bucket — `tracked` is then deterministically re-derived server-side.

PATCH route strips `classification` entirely via `ALLOWED_PATCH_FIELDS` (Decision A) — there is no post-save edit path for classification.

---

### `scripts/backfill-classification.ts` — REVIEWED, NO FINDING

**Why no finding:** 
- `grep` confirms no hardcoded secrets — `ANTHROPIC_API_KEY` and `DATABASE_URL` are read from `process.env` (lines 135–140), explicitly checked at boot, and thrown loudly if missing.
- No `console.log` of either env var anywhere in the file.
- Runs as an explicit CLI script (`npx tsx scripts/backfill-classification.ts`) — not exposed as an API route, not auto-invoked, not in any cron/hook.
- Has a `--dry-run` flag (line 31).
- Writes only `classification` and `tracked` fields per CONSTRAINT-07 (line 119) — surgical update, no other mutation surface.
- Uses Prisma's parameterized `update({ where: { id }, data: {...} })` — no SQL string concatenation.

The script is committed to git but that is acceptable: it contains no secrets, only references env-loaded ones. Auditor recommendation: add a small README note in `scripts/` clarifying that running this script will incur Anthropic API charges per re-classified benefit. (Documentation gap, not security.)

---

### `npm audit` triage — 28 advisories, MEDIUM consolidated above

**Summary:** 13 moderate / 15 high / 0 critical. The only direct runtime-affecting package is `next` (covered under the MEDIUM finding above).

Categorization of the remaining 27:

**Dev-tooling only (NOT in runtime bundle, no MVP exposure):**
- `prisma` (high, direct) + `@prisma/config` + `@prisma/dev` + `@mrleebo/prisma-ast` + `chevrotain` + `@chevrotain/cst-dts-gen` + `@chevrotain/gast` + `lodash` + `hono` + `@hono/node-server` + `effect` — all reach the codebase only through the `prisma` CLI used for migrations and codegen. Never executed at runtime.
- `vitest` (moderate, direct) + `vite` + `vite-node` + `@vitest/mocker` + `esbuild` — test-runner-only. Esbuild dev-server CORS advisory (GHSA-67mh-4wv8-2f99) does not apply because the dev server is not used in production. Fix requires `vitest@4.x` (semver-major); deferrable.
- `minimatch`, `picomatch`, `brace-expansion`, `path-to-regexp`, `ajv`, `defu`, `fast-uri`, `flatted`, `ip-address`, `express-rate-limit` — transitive build/tooling. Several are ReDoS — no untrusted input reaches them at runtime.

**Resolved by the `next@16.2.6` bump above:** `postcss` (moderate, transitive via next).

**Recommendation:** Run `npm audit fix` once. This bumps `next` to 16.2.6 (non-breaking) plus all `fixAvailable: true` advisories. The remaining items (mostly `vitest@4` major) can wait. None of the 28 represent an active risk to the MVP local-only deployment, but the hygiene fix is essentially free.

---

### SEC-07 — sensitive-file git-history sweep

`git log --all --diff-filter=A --name-only` was searched for: `.env`, `.env.*` (except `.env.example`), `docs/testing-setup.md`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `profile.md`, `content/`, `CLAUDE.md`, `manifest.md`. **Only `.env.example` appears** (allowed by SEC-07). `.env.example` was reviewed — contains placeholders only (`your_key_here`, `your_secret_here`, `your_password_here`), no real values.

`git status` shows no SEC-07 files staged or untracked. `.gitignore` covers every required file (verified lines 9, 26–33).

✓ SEC-07 clean.

---

**Summary:** 0 Critical / 0 High / 1 Medium / 7 Low (3 carried forward unresolved, 4 resolved this audit, 1 carried forward as accepted exception).

**Verdict:** CLEAR — no critical or high findings. One Medium finding (`next@16.1.6` advisories) recommended for immediate `npm audit fix` but does not block on the local-only single-user MVP threat model. Three Low findings (LOW-6, LOW-9, LOW-10) are local-only-acceptable and must be fixed before Phase 2 Vercel migration; LOW-3 is the accepted CONSTRAINT-14 exception.

---

## Active Low findings (non-blocking)

### LOW-3 — Plaintext admin password (carried forward — CONSTRAINT-14)
File: `src/lib/auth.ts:10`. Accepted exception. Must revisit at Phase 2.

### LOW-6 — 404 vs 403 enumeration on GET benefits (carried forward)
File: `src/app/api/user-cards/[id]/benefits/route.ts:29–30`. Local-only — negligible. Phase 2 fix.

### LOW-9 — Timing side-channel in `authorizeUser` (carried forward)
File: `src/lib/auth.ts:9–10`. Local-only — negligible. Must fix before Phase 2 Vercel migration.

### LOW-10 — 404 vs 403 on POST usage (carried forward)
File: `src/app/api/benefits/[id]/usage/route.ts:27–30`. Local-only — negligible. Phase 2 fix.

### LOW-11 — `scripts/backfill-classification.ts` — no usage README
File: `scripts/backfill-classification.ts`. Documentation gap, not security. Recommend adding a `scripts/README.md` note about Anthropic API cost per run.

---

## Resolved this audit
- ~~LOW-1~~ — `customIssuer`/`customName` length enforced (≤100 at `src/app/api/user-cards/route.ts:54`).
- ~~LOW-2~~ — `anniversaryDate` validated (`isNaN(parsed.getTime())` at `src/app/api/user-cards/[id]/route.ts:32`).
- ~~LOW-4~~ — `name`/`description` length enforced in confirm route (`src/app/api/benefits/confirm/route.ts:21–24`).
- ~~LOW-5~~ — `value` type-checked + `tracked` server-derived + `classification` allowlist enforced (`src/app/api/benefits/confirm/route.ts:26, 32, 49`).
- ~~LOW-7~~ — `name`/`description` length enforced in PATCH (`src/app/api/benefits/[id]/route.ts:47–48`).
- ~~LOW-8~~ — `value` type-checked + `tracked`/`classification` stripped via allowlist (`src/app/api/benefits/[id]/route.ts:16–18, 50`).

---

## Historical findings (prior audits)

### ~~MEDIUM~~ RESOLVED — SEC-07: CLAUDE.md, docs/session-log.md, docs/session-handoff.md in git history
Resolved 2026-04-07. Files removed from history. `.gitignore` covers all SEC-07 files. ✓
