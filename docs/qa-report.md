# QA Report

**Date:** 2026-06-07
**Status:** APPROVED

> **Re-run 2026-06-07 (post-fix):** The single blocking finding (CONSTRAINT-23 overlay width) was fixed via @dev targeted-fix mode and re-verified live by the QA authority — the expanded card-detail overlay now renders a centered 420px column (width 420, left 422). Status flipped BLOCKED → APPROVED. See Finding 1 (RESOLVED) and the updated Summary.

> **Feature 9 — Pixel-Perfect Three-Screen Redesign sign-off (Tasks 56–66).** Shippability assessment for the Overview / Cards / Admin rebuild + app-wide desktop container (CONSTRAINT-23). Supersedes the 2026-06-03 Phase H / Feature 8 APPROVED report (Tasks 49–55), which remains in git history. Phase 2 browser workflow verification was executed this session via DevTools Puppeteer against the live app at `http://localhost:3002` at the 1280px desktop viewport (the MVP deployment target), with hybrid manual login and non-destructive verification.

---

## Scope

Feature 9 (Tasks 56–66): canonical design-token module, `annualFee` schema + parser + confirm persistence, per-benefit confidence/note (review-only), `computePortfolioStats` + `/api/portfolio/stats`, Overview/Cards/Admin pixel rebuilds, issuer-color migration, and the centered `max-w-[420px]` desktop column (CONSTRAINT-23). Reviewed against `rules/testing-standards.md` (TS-01/TS-04) and the binding constraints in `docs/constraints.md`.

Verification split: Phase 1 (code + coverage) and Phase 2 (browser) were each run by a subagent; the QA authority then **independently re-verified both candidate-blocking findings in the live app** before issuing this verdict.

---

## Coverage Assessment

### Critical Paths
- [x] Auth flows tested: **PASS** — `lib/auth.test.ts` (happy + wrong-password + valid-JWT + 401-no-session)
- [x] Payment flows tested: **N/A** — no payments in scope (CardMaxxer has no payment surface)
- [x] Data write operations tested: **PASS** — `updateBenefitUsage()` (sole sanctioned usage path) covered by `usage.integration.test.ts` (happy/clamp/negative/403); review-gate save covered by `confirm.integration.test.ts` + `benefits.integration.test.ts` (replace/empty/invalid-enum/annualFee/strip-confidence)
- [x] Access control tested: **PASS** — 401 unauth (`user-cards`), 403 wrong-user (`user-cards` DELETE, `benefit-mutation` PATCH/DELETE, `benefits` GET)

**Test suite:** 292/292 green — 225 unit/component (`npx vitest run`, 34 files) + 67 integration (`npm run test:integration`, 13 files). 0 failures, 0 skips.
**Build:** `npm run build` — PASS (Next.js 16.2.6 / Turbopack, TypeScript clean, all 20 routes resolved incl. `/api/portfolio/stats`).

### Coverage Gaps
1. **Issuer-color backfill migration (`scripts/backfill-issuer-colors.ts`) — zero tests.** Performs conditional DB writes (old-seed → new-token, preserving user overrides). No automated assertion of idempotency / override-preservation. Already executed once against backed-up DBs (the `.bak-20260604-task64` files). NON-BLOCKING.
2. **`authorizeUser` has one error-case test, not two** (TS-01 requires 2 for auth functions). Missing: unknown-email and/or unconfigured-`ADMIN_PASSWORD` path. The security-critical wrong-password path IS covered. NON-BLOCKING.
3. **Scrape route has no explicit 401 test** (success/scrapeError/parseError/null-URL are covered). The `requireAuth` pattern is proven on sibling routes. NON-BLOCKING.

---

## Browser Workflow Verification

### Overview (`/overview`)
**Result:** PASS
**Steps:** Loaded authenticated; swept rendered text.
**Observed:** "Money at risk", "Active credits 23 total", category groups render. No blank states, no error boundary, no `$undefined`/`NaN`/`[object Object]`. CONSTRAINT-19 confirmed — no realized-value figures on Overview ("$X redeemed of $Y" strings are per-category credit progress, not realized totals).
**Issues:** None.

### Cards (`/cards`) — collapsed wallet view
**Result:** PASS
**Observed:** Apple-Wallet stack renders with correct issuer colors (Capital One red, Amex gold, Chase blue). Portfolio header shows Annual Fees / Redeemed YTD / Available (realized value correctly lives here per CONSTRAINT-19). Centered 420px column (left offset 422, symmetric).
**Issues:** None.

### Cards (`/cards`) — expanded card detail overlay
**Result:** PASS (after fix — see Finding 1 RESOLVED)
**Observed (initial):** Per-card Annual/Available/Redeemed tiles + full benefit list render correctly with usage controls. BUT the overlay's content wrapper measured **1011px wide (left offset 126) at 1280 viewport** — nearly full-width, NOT the centered ~420px column every other screen uses. Direct CONSTRAINT-23 violation.
**Observed (post-fix, re-verified live):** Overlay wrapper now measures **width 420px, left offset 422, right gap 438** — centered 420px column matching Overview/Cards/Admin. Class `mx-auto w-full max-w-[420px] px-6`. Animation, backdrop, and data intact.
**Possible cosmetic:** a section label may render with a stray `$` ("$CREDITS") — low confidence; likely an innerText-concatenation artifact, flagged for a glance, not asserted as a defect.

### Usage update (reversible live test — QA authority, in person)
**Result:** PASS (core value-tracking path fully working)
**Steps:** Expanded Amex Platinum → $600 Hotel Credit input (original `usedAmount` = 0, recorded). Filled to 100 with simulated typing, committed on blur.
**Observed:** Per-card REDEEMED $0 → **$100**, AVAILABLE $2,001 → **$1,901** (optimistic recompute, live). Reloaded: value **persisted to DB** ($100, portfolio Available $2,520 → $2,420), confirming the full POST `/api/benefits/[id]/usage` → server-recompute path. **Reverted to 0 and re-verified after reload — all figures back to baseline. User data intact.**
**Note:** The Phase-2 subagent had flagged this as "unverified — totals didn't react." That was a controlled-React-input simulation artifact (programmatic `.value` + events don't reliably update React's internal `inputText` state, so its commit used the stale value). Direct verification with real input proves the behavior is correct. **Not a defect.**

### Admin (`/admin`)
**Result:** PASS
**Observed:** Admin home (stats + card list with re-scan/delete — not touched), add-card picker (preset search + custom-card form). **Form validation fires correctly:** empty → submit disabled; whitespace-only → disabled (trims); only-issuer → disabled (both required); both filled → enabled; cleared → disabled. CONSTRAINT-20 confirmed — zero toasts during validation (toasts reserved for add/remove). Centered 420px column.
**Issues:** None. (No scrape triggered — non-destructive policy.)

---

## Edge Case Assessment

- Invalid/empty form inputs on add-custom-card: validation gates submission correctly (verified live).
- Usage input clamping: covered by `usage.integration.test.ts` (clamp + negative) and the slider's `clamp()` (verified in code).
- No JS error boundaries, blank states, or bad-value strings surfaced on any of the three screens.
- Centered-column (CONSTRAINT-23) holds on Overview, Cards-collapsed, and Admin (all 420px, left 422). Fails only on the expanded-card overlay (Finding 1).

---

## Findings

### RESOLVED (was BLOCKING) — Finding 1: Expanded card-detail overlay violates CONSTRAINT-23 (full-width, not centered 420px column)

> **Resolution (2026-06-07):** Fixed in `src/components/cards/card-detail-overlay.tsx:65` — wrapper changed from `style={{ width: "80%" }}` to `className="mx-auto w-full max-w-[420px] px-6"` (matches the app shell's `max-w-[420px]` at `app/(app)/layout.tsx:20` + the Cards screen's 24px inset). Animation/backdrop/props unchanged. 292/292 tests pass, build clean, file 157 lines (< 200, CQ-02). QA authority re-verified live after a dev-server restart: overlay = 420px wide, centered (left 422). Closed.

**Founder Brief**
**Decided:** On desktop, tapping any card opens a detail panel that stretches to ~1011px wide while every other screen is a tidy centered 420px column — a direct violation of CONSTRAINT-23 (the desktop centered-column constraint added in the most recent commit).
**Means for your product:** The primary card-interaction screen looks broken/inconsistent versus the rest of the app on the only deployment target (desktop). For a feature whose entire deliverable is layout fidelity ("pixel-perfect three-screen redesign"), this is the acceptance bar, not a cosmetic aside.
**Check before approving:** After the fix, re-expand a card at 1280px and confirm the detail content sits in a centered ~420px column matching Overview/Cards/Admin.
**What this closes off:** Nothing — the fix is additive (a max-width on the existing wrapper).

**What is wrong:** `src/components/cards/card-detail-overlay.tsx:61` — `<div className="mx-auto" style={{ width: "80%" }}>`. The overlay root is `fixed inset-0` (line 40), so it escapes the app shell's centered `max-w-[420px]` container; its inner wrapper is then `width: 80%` of the full window (≈1011px at 1280). Leftover from the mobile-only era (80% of 375px was fine); CONSTRAINT-23's container (Task 65) was applied to the main shell but never to this `fixed` overlay.
**What must be done:** Cap the overlay content wrapper at the 420px column — e.g. replace `width: "80%"` with `max-w-[420px]` (plus side padding) on the `mx-auto` wrapper (and/or center the `fixed` overlay's content to the same column). Re-run `@qa` after the fix.

---

### NON-BLOCKING — Finding 2: Issuer-color migration script has no regression test

**What is wrong:** `scripts/backfill-issuer-colors.ts` does override-preserving DB writes with no test asserting idempotency / override-preservation (Coverage Gap 1).
**What must be done:** Write a regression test before the script is ever re-run. Does not block ship — it already ran once against backed-up DBs and the result was verified manually.

### NON-BLOCKING — Finding 3: TS-01 shortfalls (auth 2nd error-case, scrape 401)

**What is wrong:** `authorizeUser` has one error-case test (TS-01 wants two for auth functions); the scrape route has no explicit 401 test (Coverage Gaps 2–3).
**What must be done:** Add the unknown-email/unconfigured-password auth test and a scrape-route 401 test. Quality debt; the patterns are proven elsewhere.

### NON-BLOCKING — Finding 4: Possible stray `$` on expanded-view section label

**What is wrong:** A section header may render as "$CREDITS" in the expanded card view. Low confidence — likely an innerText artifact, not a visible defect.
**What must be done:** Eyeball the expanded-card section headers; fix only if a real stray `$` is visible.

---

## Summary

**Blocking issues:** 0 (1 found, 1 fixed + re-verified)
**Non-blocking issues:** 3

**Verdict:**
**APPROVED** — Feature 9 is shippable. The one blocking finding (Finding 1: CONSTRAINT-23 violation on the expanded card-detail overlay) was fixed and re-verified live (overlay now a centered 420px column). All test coverage is green (292/292), the build is clean, every runtime critical path is covered, and the core value-tracking write path was verified live end-to-end. Three non-blocking quality-debt items remain (Findings 2–4) — documented, not gating.

**Recommended follow-ups (non-gating):**
- Re-run `@security` — the prior security report (2026-06-04 CLEAR) predates the Feature 9 UI; a quick re-audit is prudent before relying on the app daily.
- Address Findings 2–4 (migration-script test, auth 2nd error-case test, scrape 401 test, cosmetic `$CREDITS` check) when convenient.
- Commit the fix; `main` is currently ahead of `origin/main` and the overlay fix is uncommitted.
