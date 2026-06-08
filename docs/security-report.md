# Security Report: CardMaxxer

**Last audit:** 2026-06-07 (Feature 9 — Pixel-Perfect Three-Screen Redesign, Tasks 56–66)
**Scope:** Feature 9 diff. Security-relevant surfaces: new `/api/portfolio/stats`, `/api/benefits/confirm` (annualFee + confidence/note handling), `/api/benefits/[id]` (PATCH/DELETE), `/api/user-cards/[id]/scrape`, `/api/user-cards` (1-line annualFee add), parser (`src/lib/parser/*`), `scripts/backfill-issuer-colors.ts`, `src/lib/engine/portfolio.ts`. Plus full SEC-07 sensitive-file sweep, git-history scan, and `npm audit` dependency check. Supersedes the 2026-06-04 Phase H report (in git history).
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 2 Medium / 1 Low (+ carried-forward accepted deviations)

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** (as above) — Feature 9 surfaces, SEC-07/git/deps.
**Status:** CLEAR
**Method:** Two parallel audits (code-vulnerability review + SEC-07/git/dependency sweep), severity adjudicated by the security authority.

---

### Code surface — PASS (no Critical/High/Medium)

The Feature 9 diff is well-hardened. Verified against SEC-01–SEC-09:

- **`/api/portfolio/stats` (new)** — SEC-04: `requireAuth()` enforced (401 on fail), query scoped `where: { userId }` (no IDOR). SEC-05: catch returns generic "Internal server error"; response is aggregate numbers only.
- **`/api/benefits/confirm` (review-gate save)** — SEC-02 + mass-assignment: `createBenefitWithPeriod` uses an explicit column allowlist in `tx.benefit.create`; `confidence`/`note` are rest-destructured out and **cannot reach the DB** even if a client smuggles them in (server-side strip, not client trust). `validateAnnualFee` rejects non-number/NaN/Infinity/negative, accepts null. Benefit fields validated with enum allowlists + length caps. Ownership enforced (404/403). Prisma-parameterized writes scoped to owned `userCard`.
- **`/api/benefits/[id]` (PATCH/DELETE)** — `ALLOWED_PATCH_FIELDS` allowlist prevents mass assignment; `classification` excluded (server-derived); auth + 403 ownership on both verbs.
- **Parser (`src/lib/parser/*`)** — SEC-01: API key from `process.env` only, no hardcoded secret. SEC-05: no raw LLM response logged; debug output gated on `DEBUG=true` and limited to token counts; `rawTextPreview` caps scraped input at 200 chars.
- **`scripts/backfill-issuer-colors.ts`** — SEC-03: `better-sqlite3` prepared statements with `?` placeholders, no concatenated SQL; hardcoded hex constants only. Creates a timestamped backup and is idempotent.
- **Server Actions:** none in the project (`'use server'` = 0 matches) → **SEC-08 and SEC-09 N/A**.

---

### MEDIUM — Finding 1 (RESOLVED this audit): DB backup files slipped past `.gitignore`

**Rule:** SEC-07 (spirit — sensitive/personal data must never be commit-able)

**Founder Brief**
**Decided:** Two full SQLite database copies (`dev.db.bak-20260604-task64`, `prisma/dev.db.bak-20260604-task64`) were untracked but NOT covered by `.gitignore` — the `*.db` glob only matches the `.db` extension, and these end in `.bak-...`.
**Means for your product:** They were one `git add .` away from being committed. The DB holds your card list, benefit usage, and account email (personal/financial data) — committing + pushing it to a remote would leak that. Note: it holds **no credentials** (the admin password lives in `.env`, which is properly ignored), so this is a privacy exposure, not a credential compromise.
**Check before approving:** Confirm `git check-ignore dev.db.bak-20260604-task64` now returns the path (ignored).
**What this closes off:** Nothing.

**What is wrong:** `.gitignore` `*.db` glob did not match the timestamped `.bak-*` suffix.
**What could go wrong:** Accidental `git add .` → commit → push leaks personal DB contents permanently into history.
**How to fix it:** **DONE this audit** — added `*.db.bak*` and `*.bak` to `.gitignore`; verified both files now return from `git check-ignore`. Severity MEDIUM (not High) because nothing was ever committed (git history is clean — see below) and there is no external attacker vector, only accidental user commit. **Recommended follow-up (your call):** delete the two stray `.bak` files — they are leftover task-64 backups already flagged as deferred cleanup.

---

### MEDIUM — Finding 2: Five moderate dependency CVEs (0 critical/high)

**Rule:** Insecure dependencies (known CVEs)

**Founder Brief**
**Decided:** `npm audit` reports 5 moderate advisories, 0 critical/high.
**Means for your product:** Low real-world exposure for a local single-user MVP. The postcss/Next XSS (GHSA-qx2v-qp2m-jg93) requires serving attacker-controlled CSS; the `@hono/node-server` middleware-bypass (GHSA-92pp-h63x-v22m) sits in Prisma **dev tooling**, not the runtime app.
**Check before approving:** After upgrading, re-run `npm audit` and confirm moderate count drops.
**What this closes off:** Nothing — both fixes are semver-major (`next` and `prisma`), so test after bumping.

**What is wrong:** `postcss <8.5.10` (under `next`) XSS; `@hono/node-server` (under `@prisma/dev`) static-serve bypass; `prisma`/`@prisma/dev` transitive.
**What could go wrong:** Realistically little in this deployment model; tracked, not blocking.
**How to fix it:** Schedule a Prisma (→ 6.19.3) + postcss/Next bump; re-test scrape + build after. NON-BLOCKING (Medium, documented & tracked).

---

### LOW — Finding 3 (informational): Unbounded numeric `annualFee` / benefit `value`

**Rule:** SEC-02 (best-practice — input range bounds)

**What is wrong:** `validateAnnualFee` and benefit `value` accept any finite number with no upper cap.
**What could go wrong:** Harmless in single-user local context (no DoS/overflow surface; SQLite handles it). Only matters if CardMaxxer goes multi-tenant.
**How to fix it:** Add a sane upper bound (e.g. ≤ 1,000,000) at the boundary when scoping Phase 2 multi-tenant. Not actionable now.

---

### Carried-forward accepted deviations (not re-flagged)

- ADMIN_PASSWORD stored plaintext in `.env`, plaintext compare in `auth.ts` (CONSTRAINT-14 — single-user local, accepted deviation from SEC-06).
- App served over local HTTP, not HTTPS (localhost MVP — accepted SEC-06 deviation; revisit at Vercel/Phase 2).
- Prior LOW-13 activation-route enumeration (single-user; low impact).

### Confirmed CLEAN

- All 11 SEC-07 sensitive paths gitignored (incl. `CLAUDE.md`, `manifest.md`, `.env*`, all sensitive `docs/`).
- `.env.example` is a pure placeholder template — no real secrets.
- **No sensitive file (`.env`, `testing-setup.md`, any `.db`) has ever appeared in git history** across all refs — no credential rotation needed.
- No `.db` file is tracked by git.

---

**Summary:** 0 Critical / 0 High / 2 Medium / 1 Low
**Verdict:** **CLEAR** — no Critical or High findings. The one finding with actual exposure (DB-backup gitignore hole) was fixed during this audit. The two Medium items (deps, resolved gitignore) and one Low (unbounded numeric) are documented and non-blocking. Feature 9 is clear to ship from a security standpoint, subject to the carried-forward accepted local-MVP deviations.
