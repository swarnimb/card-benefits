# Security Report: CardMaxxer

**Last audit:** 2026-06-04 (Phase H GATE — Feature 8 Set-and-Forget, Tasks 49–55)
**Scope:** All code changed since the prior audit (`f5d7fee`, 2026-05-21) through `HEAD` (`1470be8`). Covers the Set-and-Forget schema migration, `setBenefitActivation()`, the activation API route, the deterministic `setAndForget` derivation in the confirm write path, the `expiring.ts` triage branch, and the `ActivationToggle` client component. Full SEC-01–SEC-09 review of the new write/input surfaces; SEC-07 sweep; carry-forward status of all prior Low findings.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 7 Low

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** Tasks 49–55 — `git diff f5d7fee HEAD`. Feature 8 introduced one new API boundary (`PATCH /api/benefits/[id]/activation`), one new engine write path (`setBenefitActivation()`), server-side `setAndForget` derivation in the confirm route, plus pure read-time triage and a client toggle. **No new dependencies were added in this range** (commits touch schema, engine, route, component, tests, and docs only), so the 2026-05-21 `npm audit` triage carries forward unchanged.
**Status:** CLEAR

---

## Files reviewed this audit

| File | Change | Security assessment |
|---|---|---|
| `src/lib/engine/usage.ts` | NEW `setBenefitActivation()` — sole write path for `Benefit.activatedAt` (CONSTRAINT-16) | Parameterized `prisma.benefit.update({ where: { id }, data: { activatedAt } })`. Validates benefit exists and is `setAndForget` (else throws `ActivationEngineError`). `${benefitId}` appears only in error-message strings, never in a query. No internal ownership check — auth is enforced by the caller (the route), consistent with `updateBenefitUsage()`. Clean. |
| `src/app/api/benefits/[id]/activation/route.ts` | NEW `PATCH` route | Auth (SEC-04): `requireAuth()` → 401, then resource-ownership `benefit.userCard.userId !== getUserId()` → 403. Input (SEC-02): JSON parsed in try/catch, non-object/array rejected (400), `activated` required `boolean` (400). No mass assignment — only `activated` is extracted and forwarded; the full body is never spread into the write. Structurally identical to the existing usage route. **One Low: 404 vs 403 discrimination — see LOW-13.** Otherwise clean. |
| `src/app/api/benefits/confirm/route.ts` | `setAndForget` server-derived in the write path | `setAndForget = tracked && deriveSetAndForget(name, description, classification)` — code-derived, never trusted from LLM/client (mass-assignment defense). `activatedAt` omitted on create (Prisma defaults null). Parameterized `tx.benefit.create`. Clean. |
| `src/lib/parser/classification.ts` | NEW `detectSetAndForget()` / `deriveSetAndForget()` | Pure regex over fixed, anchored `SET_AND_FORGET_PATTERNS`. No DB, no LLM, no user-supplied patterns. No ReDoS surface (fixed literals, bounded quantifiers). Clean. |
| `src/lib/engine/expiring.ts` | Set-and-forget triage branch (Task 53) | Pure in-memory. No DB write, no SQL, no input boundary. Consumes already-fetched objects. Clean. |
| `src/components/cards/activation-toggle.tsx` | NEW client toggle (Task 54) | Client-only. `PATCH`es `{ activated: <boolean> }`; `benefitId` in the URL path is re-validated server-side. No DB/SQL. Clean. |
| `prisma/migrations/20260528051432_set_and_forget_benefits/migration.sql` | Adds `setAndForget BOOLEAN NOT NULL DEFAULT false` + `activatedAt DATETIME` | Standard Prisma-generated DDL, no dynamic SQL. Clean. |

**SEC-01:** No hardcoded secrets in any Feature 8 source (grep clean; only `process.env.*` reads). **SEC-06:** Feature 8 handles no passwords/credentials — plaintext-admin exception (LOW-3) unchanged. **SEC-08/SEC-09:** N/A — Feature 8 uses API routes (not Server Actions) and adds no auth flow.

---

## New finding (Tasks 49–55)

### LOW-13 — `PATCH /api/benefits/[id]/activation` exposes 404 vs 403

**Rule violated:** SEC-04 (resource enumeration via response discrimination)

**Founder Brief**
**Decided:** The activation route returns 404 for a non-existent benefit vs 403 for an existing benefit owned by someone else. Distinguishable codes leak which IDs exist. Same pattern as LOW-6 and LOW-10.
**Means for your product:** Negligible — single-user deployment, `getUserId()` is one static admin ID, no other users to enumerate against.
**Check before approving:** Confirm it is tracked in the Phase 2 prep checklist with LOW-6/LOW-9/LOW-10.
**What this closes off:** Phase 2 multi-user — collapse both branches to a uniform 404.

**What is wrong:** `src/app/api/benefits/[id]/activation/route.ts` — `if (!benefit) return 404` (line 26) and the ownership-mismatch `return 403` (line 29) are distinct codes.

**What could go wrong:** On a future multi-tenant deployment, an attacker probes `cuid`s to discover valid resources owned by others. Not exploitable on local-only single-user MVP.

**How to fix it:** Phase 2 — return `404` on the ownership-mismatch branch so existence and authorization are indistinguishable.

---

## Observation (not a finding)

`setBenefitActivation()` performs no internal ownership check — it trusts its single caller (the activation route, which gates ownership before calling). This matches the established engine pattern (`updateBenefitUsage()` does the same; auth lives at the route, not the engine). Not a finding. Flagged so that any future second caller of `setBenefitActivation()` is given its own auth/ownership gate.

---

## SEC-07 — sensitive-file git-history sweep (re-confirmed)

- `git status --porcelain` → clean working tree; no SEC-07 file staged or untracked.
- Full-history scan (`git log --all --pretty=format: --name-only`) for `.env`, `.env.local`, `CLAUDE.md`, `manifest.md`, `profile.md`, `docs/testing-setup.md`, `docs/session-handoff.md`, `docs/session-log.md`, `docs/framework-issues.md`, `content/` → **no matches**. Only `.env.example` is tracked (expected template).
- `.gitignore` covers all 11 required patterns (lines 9–10 for `.env`/`.env*.local`; lines 26–33 for the framework/doc files).

✓ SEC-07 clean.

---

## `npm audit` triage — carried forward unchanged

Feature 8 (Tasks 49–55) added **no dependencies**. The 2026-05-21 triage stands: 11 moderate advisories, all build/test/tooling, **0 loaded at production runtime**. None blocks ship. See LOW-12 (upstream-bound `postcss` via `next`).

---

## Active Low findings (non-blocking)

### LOW-3 — Plaintext admin password (carried forward — CONSTRAINT-14)
File: `src/lib/auth.ts:10`. Accepted exception (`dotenv-expand` corrupts bcrypt `$`; local-only). Revisit at Phase 2.

### LOW-6 — 404 vs 403 enumeration on GET benefits (carried forward)
File: `src/app/api/user-cards/[id]/benefits/route.ts:29–30`. Local-only — negligible. Phase 2 fix.

### LOW-9 — Timing side-channel in `authorizeUser` (carried forward)
File: `src/lib/auth.ts:9–10`. Early return on email mismatch. Local-only. Must fix before Phase 2 Vercel migration.

### LOW-10 — 404 vs 403 on POST usage (carried forward)
File: `src/app/api/benefits/[id]/usage/route.ts:27–30`. Local-only — negligible. Phase 2 fix.

### LOW-11 — `scripts/` directory has no usage README (carried forward)
Files: `scripts/backfill-classification.ts`, `scripts/list-cards.mjs`. Documentation/operational hygiene, not security. Recommend `scripts/README.md` distinguishing the read-only probe from the cost-incurring backfill.

### LOW-12 — Transitive `postcss <8.5.10` in `next@16.2.6` (carried forward — upstream-bound)
Advisory GHSA-qx2v-qp2m-jg93. Build-time only, no exploit path, no available fix. Closes when Next.js bumps its nested `postcss`.

### LOW-13 — 404 vs 403 enumeration on PATCH activation (NEW this audit)
File: `src/app/api/benefits/[id]/activation/route.ts:26,29`. Local-only — negligible. Phase 2 fix. Same family as LOW-6/LOW-10.

---

**Summary:** 0 Critical / 0 High / 0 Medium / 7 Low (5 carried forward unresolved, 1 accepted exception per CONSTRAINT-14, 1 documentation gap, 1 upstream-bound transitive — and LOW-13 new this audit).

**Verdict:** CLEAR — no Critical, High, or Medium findings. Feature 8 (Tasks 49–55) is shippable. The activation route correctly enforces authentication + resource ownership, validates input at the boundary, resists mass assignment (only `activated` is forwarded; `setAndForget` is server-derived), and uses parameterized Prisma exclusively. The sole new finding (LOW-13) is a Phase-2 multi-user enumeration nicety with no Phase-1 exposure. SEC-07 clean. `npm audit` unchanged (no new deps).

---

## Phase 2 prep checklist (security debt to clear before Vercel/multi-user)
- LOW-3: reintroduce hashed passwords (bcrypt at module scope, not env-bound) with a real auth provider.
- LOW-9: constant-time email/password comparison with password-shaped dummy work on the mismatch branch.
- LOW-6 / LOW-10 / LOW-13: collapse all 404-vs-403 branches to a uniform 404.
- LOW-12: re-check the `postcss` advisory; pin an `overrides` entry if still unpatched upstream.

---

## Historical findings (prior audits, kept for trail)
- ~~MEDIUM~~ (Task 42) — `next` upgraded to `^16.2.6`; 17 of 19 next-attributed advisories closed (incl. all High: cache poisoning, HTTP smuggling, middleware bypass).
- ~~LOW-1~~ — `customIssuer`/`customName` length enforced (`src/app/api/user-cards/route.ts:54`).
- ~~LOW-2~~ — `anniversaryDate` validated (`src/app/api/user-cards/[id]/route.ts:32`).
- ~~LOW-4~~ — `name`/`description` length enforced in confirm route (`src/app/api/benefits/confirm/route.ts:21–24`).
- ~~LOW-5~~ — `value` type-checked + `tracked` server-derived + `classification` allowlist enforced (`src/app/api/benefits/confirm/route.ts`).
- ~~LOW-7~~ — `name`/`description` length enforced in PATCH (`src/app/api/benefits/[id]/route.ts:47–48`).
- ~~LOW-8~~ — `value` type-checked + `tracked`/`classification` stripped via allowlist (`src/app/api/benefits/[id]/route.ts`).
- ~~MEDIUM~~ RESOLVED — SEC-07: framework files removed from history 2026-04-07; `.gitignore` covers all SEC-07 files. ✓
