# Security Report: CardMaxxer

**Last audit:** 2026-05-21 (Task 46 Phase F GATE re-audit — Tasks 43, 44, 45, 47, 48)
**Scope:** Re-audit of all code changed since the prior audit (commit `5763386`, post-Task 42) through `HEAD` (`f5d7fee`). Covers scraper instrumentation, classification overrides, the Amex scrape-URL fix, the orphan-card rollback path, and a new probe script. Full `npm audit` re-triage; SEC-07 sweep; carry-forward status of all six Low findings.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 6 Low

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** Tasks 43, 44, 45, 47, 48 — `git diff 5763386 HEAD` (18 files; 8 are non-test source files reviewed line-by-line). Dependency re-triage + SEC-07 sweep + carry-forward re-confirmation.
**Status:** CLEAR

---

## Files reviewed this audit

Non-test, non-doc source files changed since the prior audit:

| File | Change | Security assessment |
|---|---|---|
| `src/lib/parser/classification.ts` | NEW — deterministic regex override layer (NEW-5/NEW-8) | Pure module: no DB/LLM/fetch/Prisma. Regex patterns are narrow, anchored, and not user-supplied. No ReDoS surface (fixed literal patterns, bounded `\d+`/`\d+x` quantifiers — no nested/ambiguous repetition). Clean. |
| `src/lib/parser/index.ts` | `max_tokens` 4096→8192, `max_tokens` overflow branch, gated `debugLog` | New `ParserError` branch surfaces a controlled, user-actionable string. `debugLog` is `DEBUG`-gated and logs only token counts + stop_reason — no secrets, no raw content. Clean. |
| `src/lib/parser/schema.ts` | Reworded `classification` tool description | Prompt-string copy only. No code path, no input boundary. Clean. |
| `src/lib/scraper/generic.ts` | `debugLog` probe echoing scraped-text preview (NEW-6 triage) | `debugLog` is `DEBUG`-gated. Preview echoes up to 500 chars of scraped *card-marketing* text — public content, not PII or secrets. Acceptable; see note below. |
| `src/app/(app)/admin/page.tsx` | `handleReviewCancel` orphan-card rollback (NEW-1) | DELETE goes through the existing authenticated `/api/user-cards/[id]` route (server-side auth + ownership check unchanged). Non-OK response throws `CardDeleteFailedError` — failure is loud, not swallowed (EH-01). Clean. |
| `src/components/admin/benefit-review-gate.tsx` | Async `onCancel`, `cancelError` surfacing | Cancel errors are caught, logged with context, and shown to the user — no silent swallow. `console.error` logs the `userCardId` (a cuid, not sensitive) and the error. Clean. |
| `src/lib/errors/card-delete-failed.ts` | NEW — named error class | Carries `userCardId` + HTTP status + body text. `bodyText` originates from this app's own DELETE route (controlled error JSON), not an untrusted third party. No sensitive data. Clean. |
| `scripts/list-cards.mjs` | NEW — one-off local DB probe | Read-only. Uses Prisma query builder (parameterized — SEC-03 satisfied). Reads `DATABASE_URL` from env via `dotenv` (SEC-01 satisfied — no hardcoded secret). No mutation, no Anthropic API call, no cost. See LOW-11 (documentation gap now spans two scripts). |
| `data/card-catalog.json` | Amex Platinum `scrapeUrl` corrected | Hardcoded trusted constant (an `americanexpress.com` URL). The scraper fetches it; no user input flows into the URL. Not a credential. Clean. |

**No new code path introduces an input boundary, a DB write outside `updateBenefitUsage()`/existing routes, an auth surface, or an external-service connection.** The classification override layer is pure and deterministic; the scraper/parser changes are instrumentation + a model parameter. Dependency counts unchanged: `node -e` reports 17 deps / 17 devDeps (same as prior audit).

**Note on the `generic.ts` scrape preview (not a finding):** the `DEBUG`-gated probe line echoes up to 500 chars of scraped text. Scraped content is public card-marketing copy from issuer websites — by design it contains no PII, no credentials, no user data. Logging it under an explicit `DEBUG` flag does not violate SEC-05. Flagged here only so a future reviewer does not re-discover it: if the scraper is ever pointed at authenticated/account pages (not in scope for MVP — catalog URLs are public marketing pages), revisit this.

---

## New findings (Tasks 43–48) — none

No new Critical, High, Medium, or Low findings. All eight changed source files were reviewed against SEC-01 through SEC-09 and the common-vulnerability checklist (injection, broken auth, sensitive-data exposure, broken access control, misconfiguration, insecure dependencies, mass assignment). The one documentation-hygiene observation — a second script in `scripts/` with still no README — is folded into the existing LOW-11 rather than raised as a separate finding (same gap, same fix).

---

### LOW-3 — Plaintext admin password (CONSTRAINT-14, carried forward — unchanged)

**Rule violated:** SEC-06 (accepted exception per CONSTRAINT-14)

**Founder Brief**
**Decided:** `ADMIN_PASSWORD` is read as plaintext from `.env`. The framework rule says hashed; CardMaxxer accepts plaintext because `dotenv-expand` (used by Next.js) corrupts bcrypt hashes containing `$` and the app is local-only.
**Means for your product:** Negligible for MVP. The `.env` file is local-only, gitignored, and never leaves your machine. Anyone with filesystem access already has access to everything else (SQLite DB, scraped data) — so the password isn't a meaningful barrier in that threat model.
**Check before approving:** Confirm `.env` remains gitignored (verified — `.gitignore` line 9 covers `.env`, line 10 covers `.env*.local`). Confirm `.env` does not appear in `git log --all` (verified — SEC-07 sweep below returned no output).
**What this closes off:** Phase 2 (multi-user Vercel) must reintroduce hashed passwords with an auth provider — likely Postgres + NextAuth Credentials with bcrypt at module scope, not env-var-bound.

**What is wrong:** `src/lib/auth.ts` line 10 compares `password !== process.env.ADMIN_PASSWORD` directly. No hashing. Re-verified this audit — file unchanged since the prior report.

**What could go wrong:** On a multi-user or remote deployment, a `.env` exfiltration discloses the live password in cleartext. Not exploitable on local-only single-user MVP.

**How to fix it:** Documented as carried forward under CONSTRAINT-14. Must be revisited in Phase 2 — file blocker into Phase 2 prep checklist.

---

### LOW-6 — GET /api/user-cards/[id]/benefits exposes 404 vs 403 (carried forward, unchanged)

**Rule violated:** SEC-04 (resource enumeration via response discrimination)

**Founder Brief**
**Decided:** Probing the `[userCardId]` slug returns 404 for non-existent vs 403 for existing-but-owned-by-someone-else. Distinguishable response codes leak which IDs exist.
**Means for your product:** Negligible — single-user deployment, no other users to enumerate against.
**Check before approving:** Phase 2 must collapse to a uniform 404.
**What this closes off:** Phase 2 multi-user — collapse both branches to 404.

**What is wrong:** `src/app/api/user-cards/[id]/benefits/route.ts` lines 29–30 — distinct status codes. Not changed by Tasks 43–48 (route file is outside this audit's diff).

**What could go wrong:** On multi-tenant, an attacker probes `cuid`s to discover valid resources owned by other users. Not exploitable here.

**How to fix it:** Phase 2 work — collapse to uniform 404.

---

### LOW-9 — Timing side channel in `authorizeUser()` (carried forward, unchanged)

**Rule violated:** SEC-04 / SEC-09 (timing leaks across observable channels)

**Founder Brief**
**Decided:** `authorizeUser()` short-circuits on email mismatch before checking the password. An attacker measuring response time can tell whether the email is the registered admin email.
**Means for your product:** Negligible — there is one admin email and the attacker would have to be on the local network. No realistic Phase-1 exposure.
**Check before approving:** Phase 2 must replace with a constant-time comparison and password-shaped dummy work on the email-mismatch branch.
**What this closes off:** Phase 2 multi-user — must address before Vercel migration.

**What is wrong:** `src/lib/auth.ts` lines 9–10 — early return on email mismatch (`if (email !== process.env.ADMIN_EMAIL) return null;`) skips the password check; response timing differentiates "wrong email" from "wrong password." Re-verified this audit — file unchanged since the prior report.

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

**What is wrong:** `src/app/api/benefits/[id]/usage/route.ts` lines 27–30 — distinct status codes. Not changed by Tasks 43–48.

**What could go wrong:** Same as LOW-6 — multi-tenant enumeration.

**How to fix it:** Phase 2 work.

---

### LOW-11 — `scripts/` directory has no usage README (carried forward, scope widened)

**Rule violated:** Documentation gap (no SEC rule — operational hygiene)

**Founder Brief**
**Decided:** The `scripts/` directory now holds two files — `backfill-classification.ts` (calls Claude Haiku once per benefit row — real-dollar cost) and the new `list-cards.mjs` (read-only DB probe, no cost). There is still no README explaining which script is safe to run casually and which carries a cost.
**Means for your product:** Not a security risk. An operational footgun. The backfill script has a `--dry-run` flag (line 31), so the loaded-gun behaviour requires explicit `--apply`. `list-cards.mjs` is harmless.
**Check before approving:** Add `scripts/README.md` listing both scripts: `list-cards.mjs` = safe read-only probe; `backfill-classification.ts --apply` = per-row Anthropic cost, always `--dry-run` first.
**What this closes off:** Nothing — purely additive documentation.

**What is wrong:** `scripts/` contains `backfill-classification.ts` and `list-cards.mjs` (verified via `Glob scripts/*`) with no README. No cost-warning comment at the top of the backfill file. The new `list-cards.mjs` correctly reads `DATABASE_URL` from env (no hardcoded secret — SEC-01 OK) and uses the Prisma query builder (parameterized — SEC-03 OK); it is not itself a finding, it just widens the documentation gap.

**What could go wrong:** Accidentally re-running the backfill script across the full benefits table burns Anthropic credits. Not security-relevant, but a real money/hygiene risk worth a 60-second README.

**How to fix it:** Add `scripts/README.md`: one line per script. For `backfill-classification.ts`: "Running with `--apply` calls Claude Haiku once per benefit row. Always `--dry-run` first. Cost: ~$0.007 per row." For `list-cards.mjs`: "Read-only DB probe — safe to run anytime."

---

### LOW-12 — Transitive `postcss` advisory in `next/node_modules/postcss` (carried forward — upstream-bound)

**Rule violated:** Insecure transitive dependency (no SEC-rule match — hygiene)

**Founder Brief**
**Decided:** Next.js 16.2.6 still ships a nested `postcss` < 8.5.10 with a published XSS advisory (GHSA-qx2v-qp2m-jg93, CWE-79 via unescaped `</style>` in the CSS stringify output). The advisory cannot be closed by `npm audit fix` — the tool's only suggested fix is `next@9.3.3`, a 7-major downgrade that is not a real option. The advisory closes when Next.js ships an upstream patch bumping its nested postcss.
**Means for your product:** No exploit path on the current threat model. PostCSS runs at `next build` time, not at request time — it is not in the production runtime bundle. The XSS requires an attacker to feed crafted CSS into the stringifier; the CSS in this app comes entirely from Tailwind directives and your own source files, none of which accept untrusted input. On a local-only single-user MVP, the only "user" of the build output is you.
**Check before approving:** Re-run `npm audit` after each `next` upgrade — when it drops out of the report, this LOW closes automatically.
**What this closes off:** Nothing on the current deployment. At Phase 2 (Vercel) kickoff: if this advisory has not been patched upstream by then, evaluate either a pinned override (`overrides` in `package.json`) or a build-time CSS source allowlist as Phase 2 hardening.

**What is wrong:** `npm audit` reports `postcss <8.5.10` at `node_modules/next/node_modules/postcss`. No direct fix path — `fixAvailable` proposes a `next` major downgrade that is rejected. Re-verified this audit — still present, unchanged.

**What could go wrong:** On a multi-tenant deployment where untrusted CSS input could reach the stringifier (theoretical, not present in this codebase), an attacker could inject script via an unescaped `</style>` boundary. Not reachable here.

**How to fix it:** Wait for Next.js upstream to bump its nested `postcss`. Watch the advisory page (GHSA-qx2v-qp2m-jg93). No local action recommended.

---

## `npm audit` triage — 11 advisories, all build/test/tooling (unchanged from prior audit)

**Summary:** 0 critical / 0 high / 11 moderate. Identical to the prior audit (same 11 advisories, same packages).

Classification of all 11:

**Build-time only (not in production runtime bundle):**
- `next` — direct, transitive via `postcss` (see LOW-12). Sole remaining next-attributed advisory.
- `postcss` — transitive via `next`. See LOW-12.

**Test-time only (vitest stack — never loaded in production):**
- `vitest` (direct), `@vitest/mocker`, `vite`, `vite-node`, `esbuild` — fix requires `vitest@4.x` (semver-major). Esbuild dev-server CORS advisory (GHSA-67mh-4wv8-2f99) does not apply — the vite dev server is never started in production. Deferrable.

**Tooling only (CLI surfaces — never executed at runtime):**
- `prisma` (direct), `@prisma/dev`, `@hono/node-server` — all reach the codebase through the `prisma` CLI used for migrations and codegen. The `@hono/node-server` middleware-bypass advisory (GHSA-92pp-h63x-v22m) applies only to a serving HTTP path that is never started by this project. Fix requires `prisma@6.x` (semver-major downgrade — current is 7.x). Deferrable; CONSTRAINT-11 locks Prisma 7.

**Transitive build/tooling:**
- `brace-expansion` — ReDoS via crafted glob (GHSA-f886-m6hf-6m8v). No untrusted glob input reaches this package at runtime — only build/test scripts. Fix available, will close on next dep refresh.

**Result:** Of the 11 moderate advisories, **0 are loaded at runtime in production**. The threat model risk is zero on local-only MVP. None blocks ship. No change since the prior audit — Tasks 43–48 added no dependencies (deps 17 / devDeps 17, unchanged).

---

## SEC-07 — sensitive-file git-history sweep

`git log --all --name-only -- docs/session-log.md docs/session-handoff.md docs/testing-setup.md docs/framework-issues.md CLAUDE.md manifest.md .env .env.local profile.md` returned **no output** — no SEC-07 file appears anywhere in git history, across all branches, ever.

`git status --short` shows a clean working tree — no SEC-07 files staged or untracked.

`.gitignore` (verified by reading the file) covers every required file:
- Line 9: `.env`
- Line 10: `.env*.local`
- Line 26: `CLAUDE.md`
- Line 27: `manifest.md`
- Line 28: `profile.md`
- Line 29: `content/`
- Line 30: `docs/testing-setup.md`
- Line 31: `docs/session-log.md`
- Line 32: `docs/session-handoff.md`
- Line 33: `docs/framework-issues.md`

✓ SEC-07 clean.

---

**Summary:** 0 Critical / 0 High / 0 Medium / 6 Low (3 carried forward unresolved, 1 carried forward as accepted exception per CONSTRAINT-14, 1 documentation gap, 1 upstream-bound transitive).

**Verdict:** CLEAR — no Critical, High, or Medium findings. Tasks 43, 44, 45, 47, 48 introduced no new security findings: the classification override layer is a pure deterministic module with no injection or input-boundary surface; the scraper/parser instrumentation is `DEBUG`-gated and logs no secrets or PII; the orphan-card rollback reuses the existing authenticated DELETE route and surfaces failures loudly; the new `list-cards.mjs` probe is read-only, env-sourced, and parameterized; the Amex URL fix is a trusted hardcoded constant. All six Low findings are carried forward — LOW-3/6/9/10 unchanged (re-verified at their cited lines), LOW-11 widened to note the second script in `scripts/`, LOW-12 still upstream-bound. `npm audit` is unchanged: 11 moderate, all build/test/tooling, 0 at production runtime. SEC-07 clean.

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

### LOW-11 — `scripts/` directory has no usage README (carried forward, widened)
Files: `scripts/backfill-classification.ts`, `scripts/list-cards.mjs`. Documentation gap, not security. Recommend `scripts/README.md` distinguishing the read-only probe from the cost-incurring backfill.

### LOW-12 — Transitive `postcss <8.5.10` in `next@16.2.6` (carried forward — upstream-bound)
Advisory: GHSA-qx2v-qp2m-jg93. Build-time only, no exploit path, no available fix. Closes when Next.js ships an upstream postcss bump.

---

## Resolved in prior audits (kept for trail)
- ~~MEDIUM~~ (Task 42) — `next` upgraded to `^16.2.6`; 17 of 19 next-attributed advisories closed including all High items (cache poisoning, HTTP smuggling, middleware bypass).
- ~~LOW-1~~ — `customIssuer`/`customName` length enforced (`src/app/api/user-cards/route.ts:54`).
- ~~LOW-2~~ — `anniversaryDate` validated (`src/app/api/user-cards/[id]/route.ts:32`).
- ~~LOW-4~~ — `name`/`description` length enforced in confirm route (`src/app/api/benefits/confirm/route.ts:21–24`).
- ~~LOW-5~~ — `value` type-checked + `tracked` server-derived + `classification` allowlist enforced (`src/app/api/benefits/confirm/route.ts:26, 32, 49`).
- ~~LOW-7~~ — `name`/`description` length enforced in PATCH (`src/app/api/benefits/[id]/route.ts:47–48`).
- ~~LOW-8~~ — `value` type-checked + `tracked`/`classification` stripped via allowlist (`src/app/api/benefits/[id]/route.ts:16–18, 50`).

## Historical findings (prior audits)

### ~~MEDIUM~~ RESOLVED — SEC-07: CLAUDE.md, docs/session-log.md, docs/session-handoff.md in git history
Resolved 2026-04-07. Files removed from history. `.gitignore` covers all SEC-07 files. ✓
