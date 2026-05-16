# Security Report: CardMaxxer

**Last audit:** 2026-04-10
**Scope:** Task 13 — Usage API (src/app/api/benefits/[id]/usage/route.ts, src/__tests__/api/benefits/usage.integration.test.ts)
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 10 Low (cumulative)

**Unresolved Critical/High findings:** None

---

## Active Low Findings (non-blocking)

### LOW-1 — No length constraints on `customIssuer` / `customName` (SEC-02)
File: `src/app/api/user-cards/route.ts` — `resolveOrCreateCard()`
Type and presence checked, but no max-length guard before DB write. Single-user MVP — no realistic risk.

### LOW-2 — `anniversaryDate` not validated before `new Date()` (SEC-02)
File: `src/app/api/user-cards/[id]/route.ts` — `buildUserCardUpdate()`
Invalid date strings produce `Invalid Date`; Prisma throws; error handler returns 500. No data exposed.

### LOW-3 — Plaintext admin password (SEC-06, accepted via CONSTRAINT-14)
File: `src/lib/auth.ts`
bcrypt dropped due to Next.js dotenv-expand incompatibility. `.env` is gitignored; local-only deployment. No fix for MVP.

### LOW-4 — No type/length guard on `name` / `description` in benefit confirm (SEC-02)
File: `src/app/api/benefits/confirm/route.ts` — `validateBenefits()`
`name` and `description` not length-checked before DB write. Missing `name` returns 500 instead of 400. Consistent with LOW-1. Fix if multi-user planned.

### LOW-5 — `value` and `tracked` not type-validated in benefit confirm (SEC-02)
File: `src/app/api/benefits/confirm/route.ts` — `validateBenefits()`
`value` not checked for finite/non-negative. `tracked` not checked as boolean. Prisma handles or throws (→ 500). Single-user, auth required — no exploitation path.

### LOW-6 — GET /api/benefits/[userCardId] exposes 404 vs 403 distinction (minor enumeration)
File: `src/app/api/benefits/[userCardId]/route.ts`
Distinct 404 (not found) and 403 (wrong owner) allows probing for valid userCardIds. Spec-required 403, local-only single-user deployment — negligible in practice.

### LOW-7 — No length/type guard on `name` / `description` in PATCH benefit (SEC-02)
File: `src/app/api/benefits/[id]/route.ts` — `extractPatchFields()`
`name` and `description` passed from request body without `typeof === "string"` or max-length check. Non-string value → Prisma throws → generic 500. No data exposure. Consistent with LOW-4.

### LOW-8 — `value` and `tracked` not type-validated in PATCH benefit (SEC-02)
File: `src/app/api/benefits/[id]/route.ts` — `extractPatchFields()`
`value` not checked for finite/non-negative. `tracked` not checked as boolean. Prisma throws → generic 500. Single-user, auth required — no exploitation path. Consistent with LOW-5.

### LOW-9 — Timing side channel in `authorizeUser()` (auth.ts)
File: `src/lib/auth.ts`
Negligible on local-only desktop deployment. Must be fixed before Phase 2 Vercel migration (see assumptions A9).

### LOW-10 — POST /usage exposes 404 vs 403 distinction (minor enumeration)
File: `src/app/api/benefits/[id]/usage/route.ts`
Returns 404 for non-existent benefit and 403 for wrong owner. Allows probing for valid benefit IDs. Consistent with LOW-6 pattern — local-only single-user deployment, negligible in practice.

---

## Historical findings (prior audits)

### ~~MEDIUM~~ RESOLVED — SEC-07: CLAUDE.md, docs/session-log.md, docs/session-handoff.md in git history
Resolved 2026-04-07. Files removed from history. .gitignore covers all SEC-07 files. ✓
