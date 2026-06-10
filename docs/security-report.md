# Security Report: CardMaxxer

**Last audit:** 2026-06-09 (Feature 10 — Usage Accuracy & In-Place Logging, Tasks 67–73)
**Scope:** Feature 10 diff. Security-relevant surfaces: `POST /api/benefits/[id]/usage` (Overview inline usage write), `PATCH/DELETE /api/benefits/[id]` (the `tracked` eye-toggle from Task 73 — mass-assignment scrutiny), `src/lib/engine/usage.ts` (`updateBenefitUsage`), `scripts/audit-benefit-values.ts`, the per-window parser changes, and the Finding-1 easing fix (UI-only). Plus full SEC-07 sensitive-file sweep, git-history scan, `npm audit`, and a `'use server'` (SEC-08) sweep. Supersedes the 2026-06-07 Feature 9 report (retained in git history).
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 1 Medium / 1 Low (+ carried-forward accepted deviations)

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** (as above) — Feature 10 surfaces, SEC-07/git/deps.
**Status:** CLEAR
**Method:** Code-evidence pass by subagent against SEC-01–SEC-09; the two highest-impact surfaces (PATCH mass-assignment, usage-write resource authz) re-verified in person by the security authority (`route.ts:15-17,38-44,82-94` read directly).

---

### Code surface — PASS (no Critical/High)

Verified against SEC-01–SEC-09:

- **`POST /api/benefits/[id]/usage` (Overview inline logging, new path)** — SEC-04: `requireAuth()` → 401; **resource ownership enforced** — `benefit.userCard.userId !== getUserId()` → 403 (no IDOR). SEC-02: body type-guarded, `usedAmount` validated as finite ≥ 0 before business logic; authoritative upper bound clamped in `updateBenefitUsage`. SEC-05: catches log server-side, return generic "Internal server error".
- **`PATCH /api/benefits/[id]` (the `tracked` eye-toggle)** — **mass assignment defended (authority-verified):** `ALLOWED_PATCH_FIELDS` allowlist (`route.ts:15-17`) + `extractPatchFields` copies only whitelisted keys (`:38-44`) — the raw body is never spread into Prisma. `classification`, `usedAmount`, `id`, `setAndForget`, `activatedAt`, and `userCardId`/`cardId` (**ownership reassignment**) are NOT settable by a client. Per-field validation (`validatePatchFields`), auth 401 (`:83`), ownership 403 (`:94`). `value` is intentionally client-editable here (Admin edit field), validated non-negative-number-or-null — by design, distinct from the excluded `usedAmount`.
- **`updateBenefitUsage()` (`engine/usage.ts`, sole `usedAmount` writer)** — clamps to `[0, value]`; pure Prisma (no raw SQL, SEC-03); `UsageEngineError` carries only `benefitId`/`newAmount` (non-sensitive), DB cause stays server-side (SEC-05).
- **`scripts/audit-benefit-values.ts`** — SEC-01: no hardcoded secret (`DATABASE_URL` from env). SEC-03: pure Prisma in `$transaction`. The `--apply <file>` path arg is operator-supplied on a local CLI (no privilege boundary crossed); corrections validated (finite > 0) and scoped to existing benefit IDs. Benign.
- **Finding-1 easing fix** — UI-only token/animation constants (`tokens.ts` + 9 components). No auth, data, or input surface. No security relevance.
- **Server Actions:** `'use server'` = 0 matches in `src/` → **SEC-08 / SEC-09 N/A** (all mutations via standard route handlers).

---

### MEDIUM — Finding 1: Five moderate dependency CVEs (0 Critical/High)

**Rule:** Insecure dependencies (known CVEs)

**Founder Brief**
**Decided:** `npm audit` reports 5 moderate advisories, 0 critical/high (unchanged from Feature 9).
**Means for your product:** Low real-world exposure for a local single-user MVP. `postcss <8.5.10` XSS (GHSA-qx2v-qp2m-jg93, under `next`) needs attacker-controlled CSS served; `@hono/node-server` middleware-bypass (GHSA-92pp-h63x-v22m) sits in Prisma **dev tooling**, not the runtime request path.
**Check before approving:** After bumping, re-run `npm audit` and confirm the moderate count drops.
**What this closes off:** Nothing — both fixes are semver-major (`next`, `prisma`); test scrape + build after bumping.

**What is wrong:** Transitive `postcss` (under `next`) and `@hono/node-server` (under `@prisma/dev`) moderate advisories.
**What could go wrong:** Realistically little in this deployment model; tracked, not blocking.
**How to fix it:** Schedule a Prisma + Next/postcss bump; re-test after. NON-BLOCKING (Medium, documented & tracked — carried from Feature 9).

---

### LOW — Finding 2 (informational): audit-script `corrections.json` artifact not gitignored

**Rule:** SEC-07 (spirit — keep non-source artifacts out of commits)

**What is wrong:** `scripts/audit-benefit-values.ts --apply` reads a corrections file (e.g. a `corrections.json` at repo root) that is not covered by `.gitignore`. No such file currently exists in the tree.
**What could go wrong:** Minimal — the file holds benefit IDs + dollar values, **no secrets**. A stray `git add .` could commit operational data. No external attacker vector.
**How to fix it:** Optional — add `corrections.json` (or a `audit-corrections/` convention) to `.gitignore` when/if the apply mode is first used. Not blocking.

---

### Carried-forward accepted deviations (not re-flagged)

- `ADMIN_PASSWORD` plaintext in `.env`, plaintext compare in `auth.ts` (CONSTRAINT-14 — single-user local, accepted SEC-06 deviation).
- App served over local HTTP, not HTTPS (localhost MVP — accepted SEC-06 deviation; revisit at Phase 2 / Vercel).
- Unbounded numeric `value`/`annualFee` (Feature 9 LOW — harmless single-user; bound at Phase 2 multi-tenant).

### Confirmed CLEAN

- All SEC-07 sensitive paths gitignored: `.env` / `.env*.local`, `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`, and all sensitive `docs/` (`testing-setup`, `session-log`, `session-handoff`, `framework-issues`).
- `git status` — none of the 12 modified/staged files are SEC-07 sensitive (just `docs/plan.md`, `docs/qa-report.md`, source/test/component files).
- **No sensitive file (`.env`, `testing-setup.md`, any `.db`) has ever appeared in git history** — only `.env.example` (a non-secret template). No credential rotation needed.

---

**Summary:** 0 Critical / 0 High / 1 Medium / 1 Low
**Verdict:** **CLEAR** — no Critical or High findings. The two highest-risk Feature 10 surfaces (mass assignment on the `tracked` PATCH, resource-level authz on the usage write) are correctly defended (authority-verified). One Medium (carried-forward dependency CVEs) and one Low (informational gitignore gap) are documented and non-blocking. Feature 10 is clear to ship from a security standpoint, subject to the carried-forward accepted local-MVP deviations.
