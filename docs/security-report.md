# Security Report: CardMaxxer

**Last audit:** 2026-05-19 (re-audit after Task 42 — Next.js 16.1.6 → 16.2.6 patch upgrade)
**Scope:** Re-evaluation of the prior audit's MEDIUM finding following Task 42; full `npm audit` re-triage; SEC-07 sweep since prior audit; carry-forward status of LOW-1 through LOW-11.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 6 Low

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** Task 42 (Next.js patch upgrade) + dependency re-triage + SEC-07 sweep
**Status:** CLEAR

---

### ~~MEDIUM~~ RESOLVED — `next@16.1.6` ships with 19 published advisories

Resolved 2026-05-19 by Task 42. Upgraded `next` to `^16.2.6` in `package.json` (only change in the file — verified via `git diff HEAD~2 HEAD -- package.json`). All 15 High advisories closed; 17 of the 19 next-attributed advisories closed. One residual (`next/node_modules/postcss <8.5.10`) carried forward as LOW-12 — see below for rationale. Cache poisoning (GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7), HTTP smuggling (GHSA-ggv3-7p47-pfv8), middleware bypass, and the other 14 High items are all closed. ✓

---

### LOW-3 — Plaintext admin password (CONSTRAINT-14, carried forward)

**Rule violated:** SEC-06 (accepted exception per CONSTRAINT-14)

**Founder Brief**
**Decided:** `ADMIN_PASSWORD` is read as plaintext from `.env`. The framework rule says hashed; CardMaxxer accepts plaintext because `dotenv-expand` (used by Next.js) corrupts bcrypt hashes containing `$` and the app is local-only.
**Means for your product:** Negligible for MVP. The `.env` file is local-only, gitignored, and never leaves your machine. Anyone with filesystem access already has access to everything else (SQLite DB, scraped data) — so the password isn't a meaningful barrier in that threat model.
**Check before approving:** Confirm `.env` remains gitignored (verified — `.gitignore` line 9 covers `.env` and line 10 covers `.env*.local`). Confirm `.env` does not appear anywhere in `git log --all`.
**What this closes off:** Phase 2 (multi-user Vercel) must reintroduce hashed passwords with an auth provider — likely Postgres + NextAuth Credentials with bcrypt at module scope, not env-var-bound.

**What is wrong:** `src/lib/auth.ts` line 10 compares `password !== process.env.ADMIN_PASSWORD` directly. No hashing.

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

**What is wrong:** `src/app/api/user-cards/[id]/benefits/route.ts` lines 29–30 — distinct status codes.

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

### LOW-11 — `scripts/backfill-classification.ts` — no usage README (carried forward, unchanged)

**Rule violated:** Documentation gap (no SEC rule — operational hygiene)

**Founder Brief**
**Decided:** The Path B backfill script invokes Claude Haiku once per benefit row. There is no README explaining this carries a real-dollar cost. A future operator (including you, six months from now) could re-run it casually and incur charges.
**Means for your product:** Not a security risk. An operational footgun. The script does have a `--dry-run` flag (line 31), so the loaded-gun behaviour requires explicit `--apply`.
**Check before approving:** Add `scripts/README.md` noting the per-row Anthropic API cost and recommending a `--dry-run` first pass.
**What this closes off:** Nothing — purely additive documentation.

**What is wrong:** `scripts/` directory contains only `backfill-classification.ts` (verified via `ls scripts/`) with no README. No cost-warning comment at the top of the file.

**What could go wrong:** Accidentally re-running the backfill script across the full benefits table burns Anthropic credits. Not security-relevant, but a real money/hygiene risk worth a 60-second README.

**How to fix it:** Add `scripts/README.md` with one paragraph: "Running `backfill-classification.ts --apply` calls Claude Haiku once per benefit row. Always `--dry-run` first. Cost: ~$0.007 per row."

---

### LOW-12 — Transitive `postcss` advisory in `next/node_modules/postcss` (NEW — upstream-bound)

**Rule violated:** Insecure transitive dependency (no SEC-rule match — hygiene)

**Founder Brief**
**Decided:** Next.js 16.2.6 still ships a nested `postcss` < 8.5.10 with a published XSS advisory (GHSA-qx2v-qp2m-jg93, CWE-79 via unescaped `</style>` in the CSS stringify output). The advisory cannot be closed by `npm audit fix` — the tool's only suggested fix is `next@9.3.3`, a 7-major downgrade that is not a real option. The advisory closes when Next.js ships an upstream patch bumping its nested postcss.
**Means for your product:** No exploit path on the current threat model. PostCSS runs at `next build` time, not at request time — it is not in the production runtime bundle. The XSS requires an attacker to feed crafted CSS into the stringifier; the CSS in this app comes entirely from Tailwind directives and your own source files, none of which accept untrusted input. On a local-only single-user MVP, the only "user" of the build output is you.
**Check before approving:** Re-run `npm audit` after each `next` upgrade — when it drops out of the report, this LOW closes automatically.
**What this closes off:** Nothing on the current deployment. At Phase 2 (Vercel) kickoff: if this advisory has not been patched upstream by then, evaluate either a pinned override (`overrides` in `package.json`) or a build-time CSS source allowlist as Phase 2 hardening.

**What is wrong:** `npm audit` reports `postcss <8.5.10` at `node_modules/next/node_modules/postcss`. No direct fix path — `fixAvailable` proposes a `next` major downgrade that is rejected.

**What could go wrong:** On a multi-tenant deployment where untrusted CSS input could reach the stringifier (theoretical, not present in this codebase), an attacker could inject script via an unescaped `</style>` boundary. Not reachable here.

**How to fix it:** Wait for Next.js upstream to bump its nested `postcss`. Watch the advisory page (GHSA-qx2v-qp2m-jg93). No local action recommended.

---

## New findings (Task 42) — none

Task 42 was an in-place `next` version bump. No new code paths, no new dependencies, no schema changes. `node -e "Object.keys(require('./package.json').dependencies).length"` returns 17 (unchanged from prior audit), and dev deps remain 17.

---

## `npm audit` triage — 11 advisories, all build/test/tooling

**Summary:** 0 critical / 0 high / 11 moderate. Down from 28 (13 moderate / 15 high) at the prior audit.

Classification of all 11:

**Build-time only (not in production runtime bundle):**
- `next` — direct, transitive via `postcss` (see LOW-12). Sole remaining next-attributed advisory.
- `postcss` — transitive via `next`. See LOW-12.

**Test-time only (vitest stack — never loaded in production):**
- `vitest` (direct), `@vitest/mocker`, `vite`, `vite-node`, `esbuild` — fix requires `vitest@4.x` (semver-major). Esbuild dev-server CORS advisory (GHSA-67mh-4wv8-2f99) does not apply — the vite dev server is never started in production. Vite path-traversal advisory (GHSA-4w7w-66w2-5vf9) requires the dev server. Deferrable.

**Tooling only (CLI surfaces — never executed at runtime):**
- `prisma` (direct), `@prisma/dev`, `@hono/node-server` — all reach the codebase through the `prisma` CLI used for migrations and codegen. The `@hono/node-server` middleware-bypass advisory (GHSA-92pp-h63x-v22m) applies only to a serving HTTP path that is never started by this project — the `prisma` CLI does not expose `serveStatic`. Fix requires `prisma@6.x` (semver-major downgrade — current is 7.3.0). Deferrable; CONSTRAINT-11 already locks Prisma 7.

**Transitive build/tooling:**
- `brace-expansion` — ReDoS via crafted glob (GHSA-f886-m6hf-6m8v). No untrusted glob input reaches this package at runtime — only build/test scripts. Fix available, will close on next dep refresh.

**Result:** Of the 11 moderate advisories, **0 are loaded at runtime in production**. The threat model risk is zero on local-only MVP. None blocks ship.

---

## SEC-07 — sensitive-file git-history sweep

`git log --name-only --since="2026-04-10" -- docs/session-log.md docs/session-handoff.md docs/testing-setup.md docs/framework-issues.md profile.md CLAUDE.md manifest.md .env .env.local` returned **no output** — no SEC-07 file has been committed in any of the recent commits (Tasks 39, 40, 41, 42).

`git status --short` shows no SEC-07 files staged or untracked. `.gitignore` (verified) covers every required file:
- Line 9: `.env`
- Line 10: `.env*.local`
- Lines 26–33: `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`, `docs/testing-setup.md`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`

✓ SEC-07 clean.

---

**Summary:** 0 Critical / 0 High / 0 Medium / 6 Low (3 carried forward unresolved, 1 carried forward as accepted exception per CONSTRAINT-14, 1 documentation gap, 1 new upstream-bound transitive).

**Verdict:** CLEAR — no critical, high, or medium findings. The prior Medium (`next@16.1.6` advisories) is resolved by Task 42. Five Lows are carried forward unchanged (LOW-3, LOW-6, LOW-9, LOW-10, LOW-11). One new LOW (LOW-12) tracks the transitive `postcss` advisory that ships inside `next@16.2.6` — no exploit path on local-only MVP, no available fix, closes when Next.js ships an upstream postcss bump.

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

### LOW-11 — `scripts/backfill-classification.ts` — no usage README (carried forward)
File: `scripts/backfill-classification.ts`. Documentation gap, not security. Recommend adding a `scripts/README.md` note about Anthropic API cost per run.

### LOW-12 — Transitive `postcss <8.5.10` in `next@16.2.6` (NEW — upstream-bound)
Advisory: GHSA-qx2v-qp2m-jg93. Build-time only, no exploit path, no available fix. Closes when Next.js ships an upstream postcss bump.

---

## Resolved this audit (Task 42)
- ~~MEDIUM~~ — `next` upgraded to `^16.2.6`; 17 of 19 next-attributed advisories closed including all High items (cache poisoning, HTTP smuggling, middleware bypass, etc.).

## Resolved in prior audit (2026-04-10 cycle, kept for trail)
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
