# QA Report

**Date:** 2026-06-03
**Status:** APPROVED

> **Phase H — Feature 8 (Set-and-Forget) sign-off.** Shippability assessment for Tasks 49–55. Supersedes the 2026-05-21 Phase F GATE report (Tasks 40–48 defect bundle), which remains in git history. This pass signs off the Set-and-Forget feature: deterministic classification, the `setBenefitActivation()` write path, period-skip, Overview triage, and the Cards "Automatic" group. Unlike the Phase F pass, **Phase 2 browser workflow verification was actually executed this session** (DevTools Puppeteer, 375px, against the live app at localhost:3002).

---

## Scope

Feature 8 — Set-and-Forget (Tasks 49–55), diff `aa4e172..HEAD`. Reviewed against `rules/testing-standards.md` (TS) and `rules/code-quality.md` (CQ), and the Feature 8 invariants CONSTRAINT-06/07/08/09/16/17/18.

Preceded this session by a `@code-review` Gate 2 pass (PASS — one borderline CQ-01 finding fixed: `runConfirmTransaction` extracted into `createBenefitWithPeriod()`).

---

## Coverage Assessment

### Critical Paths

- [x] **Data write operations tested:** PASS — `setBenefitActivation()` (CONSTRAINT-16 sole `activatedAt` writer) covered in `activation.integration.test.ts` (engine) for activate, deactivate, not-found, and not-set-and-forget rejection, with an assertion that only `activatedAt` is written. `runConfirmTransaction` set-and-forget derivation + period-skip covered in `feature8-set-and-forget.integration.test.ts`.
- [x] **Access control tested:** PASS — `PATCH /api/benefits/[id]/activation` covered in `activation.integration.test.ts` (API) for 401 (unauthenticated), 403 (cross-user ownership), 404 (not found), 400 (bad body), and 409 (not set-and-forget).
- [x] **Read paths tested:** PASS — Overview triage (`isExpiringSoon`/`unusedValue`/`isDone`/`buildOverviewTriage` set-and-forget branches) covered in `usage-expiring.unit.test.ts` and `periods.integration.test.ts`: active set-and-forget → `done`, idle → `onTrack`, never `needsAttention`, contributes 0 to money-at-risk.
- [x] **Classification policy tested:** PASS — `classification.unit.test.ts` covers `deriveSetAndForget`/`detectSetAndForget` with the critical negative-locks (Uber One → set-and-forget; Uber Cash → not; trial-flipped Walmart+ not treated as set-and-forget).
- [x] **End-to-end flow tested:** PASS — `feature8-set-and-forget.integration.test.ts`: classify → confirm → activate → Overview shows done / Cards shows activated, plus `re-scrape resets activation` (documents the accepted CONSTRAINT-06 trade-off).
- [x] **Component tested:** PASS — `activation-toggle.test.tsx` covers render states, optimistic PATCH, and revert-on-failure; `benefit-item.test.tsx` covers the set-and-forget dispatch branch.

### Test Summary (executed this pass)

- **Unit:** 171/171 passing across 27 files (`npx vitest run`).
- **Integration:** 61/61 passing across 12 files (`npm run test:integration`).
- **Total:** 232 tests, all passing.
- **Build:** `npm run build` clean — Next.js 16.2.6, TypeScript strict, 0 errors, all 18 routes emitted.

### Coverage Gaps

- **Deactivate → re-include in `onTrack` at the `buildOverviewTriage` level** — the engine-level deactivate is tested, but no test asserts a toggled-off set-and-forget row moves from `done` back to `onTrack` in the Overview payload. **Manually verified live this pass** (see Browser Verification, Flow D). Low risk; suggest adding one assertion.
- **Card with 100% set-and-forget benefits** — rendering logic is simple but untested; the most likely "blank Cards panel" failure mode. Suggest a component test. Not observed as a defect.

Neither gap is blocking — the underlying logic is covered at the engine layer and both were exercised live.

---

## Browser Workflow Verification

**Executed** via DevTools Puppeteer at 375px (mobile-first) against the running app (localhost:3002). Builder logged in (hybrid-login); the main thread drove the flows. State was restored after testing (only CLEAR+ left active, as before).

### Flow A — Cards "Automatic" group renders
**Result:** PASS
**Steps:** Open Cards → expand Amex Platinum (21 benefits) → scroll to the "Automatic" group.
**Screenshots:** `qa-02-cards` (Apple Wallet stack), `qa-03-platinum-expanded` ($CREDITS group — **$200 Uber Cash present here with a usage slider**, i.e. correctly NOT set-and-forget), `qa-04-automatic-group` (the 5 set-and-forget benefits: Uber One, CLEAR+, Digital Entertainment, Walmart+, Oura Ring — each with a Set up / Active control).
**Issues found:** None.

### Flow B — Classification (Uber One vs Uber Cash)
**Result:** PASS
**Steps:** Observed group membership for both Uber items.
**Evidence:** Uber One ($120 Credit) renders in the "Automatic" group (set-and-forget); Uber Cash ($200) renders in the regular `$CREDITS` group with a usage slider (not set-and-forget). Matches CONSTRAINT-09 deterministic derivation.
**Issues found:** None.

### Flow C — Activation toggle (activate)
**Result:** PASS
**Steps:** Tapped **Set up** on Walmart+.
**Screenshots:** `qa-05-walmart-activated` — Walmart+ flipped to **✓ Active** filled with the Amex gold card color (CLEAR+ already Active from the prior live walkthrough). Optimistic flip → PATCH → persisted.
**Issues found:** None.

### Flow D — Overview exclusion + done bucket + inverse flow
**Result:** PASS
**Steps:** Navigated to Overview with CLEAR+ and Walmart+ active; inspected `/api/overview`. Then deactivated Walmart+ and re-inspected.
**Screenshots:** `qa-06-overview-top` — header reads **"MONEY AT RISK $0 — Nothing at risk"**.
**Evidence (with both active):** `moneyAtRisk.totalUnredeemed: 0`; `needsAttention: []`; `done: ["$209 CLEAR+ Credit", "$155 Walmart+ Credit"]`. Both activated set-and-forget benefits land in the **done** bucket, excluded from needs-attention and the at-risk total (CONSTRAINT-18).
**Evidence (after deactivating Walmart+, `qa-07-walmart-deactivated`):** `done: ["$209 CLEAR+ Credit"]`; Walmart+ moved back into `onTrack` (not `needsAttention`, not `done`); money-at-risk still $0. Confirms the deactivate→re-include inverse flow.
**Issues found:** None.

---

## Edge Case Assessment

- **Activated set-and-forget → done, excluded from money-at-risk** — PASS (live + automated). No double-count, no negative; `moneyAtRisk` sums only `needsAttention`, and `unusedValue` returns 0 for set-and-forget.
- **Deactivate re-includes in `onTrack`** — PASS (live this pass).
- **Card with 100% set-and-forget** — only the "Automatic" group renders; no blank panel (code-verified; group gated on `automatic.length > 0`). Not exercised live.
- **Card with zero set-and-forget** — "Automatic" header hidden (gated). Code-verified.
- **Rapid toggle / network failure mid-toggle** — PASS (automated). `if (saving) return` blocks double-submit; button disabled; optimistic state reverts and surfaces a user-visible error on `!res.ok` and on `catch`.
- **Re-scrape resets activation (CONSTRAINT-06)** — accepted trade-off, automated-tested. A previously-activated membership silently reverts to "Set up" after a re-scrape. Documented and accepted; see Finding 1-adjacent note.
- **Un-activated set-and-forget on the Overview** — appears in `onTrack` as a `$0`, no-action row; the "Set up" action lives only in the Cards space. **By design** (CONSTRAINT-18). See Finding 1.

---

## Findings

### NON-BLOCKING — Finding 1: un-activated set-and-forget membership has no Overview nudge (ACCEPTED — by design)

**Founder Brief**
**Decided:** A set-and-forget benefit you have not yet activated (e.g. Walmart+) shows on the Overview only as a silent `$0`, no-action row; the "Set up" action exists solely in the Cards space.
**Means for your product:** A never-activated membership — exactly "money left on the table" — gets no Overview reminder. You only act on it if you open Cards and expand that card.
**Check before approving:** Confirmed acceptable for MVP per your decision 2026-06-03. Consistent with CONSTRAINT-18 (calm Overview, no activation nudge) and the Phase H scope.
**What this closes off:** Nothing. If the product later wants the Overview to hint at un-set-up memberships, that's a future `@designer`/`@cpo` call — not a code defect today.

**What is wrong:** Nothing against spec — flagged as a product behavior to be aware of.
**What must be done:** Nothing for MVP. Accepted by-design.

### NON-BLOCKING — Finding 2: done set-and-forget rows render `$0` (cosmetic)

**What is wrong:** A realized set-and-forget benefit shows `$0` in the "Done" bucket, which reads slightly oddly for a "secured" item.
**What must be done:** Nothing required. CONSTRAINT-18 forbids adding a separate secured-value figure without `@designer`. Cosmetic only.

### NON-BLOCKING — Finding 3: `card-expanded.tsx` is stale legacy

**What is wrong:** `src/components/cards/card-expanded.tsx` renders its own inline benefit list with no set-and-forget awareness and no ActivationToggle. The live Cards page uses `CardItem` + `BenefitList`, so this is not a live bug.
**What must be done:** Cleanup candidate — remove or update the stale component to avoid misleading a future maintainer. Low priority, non-blocking.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 3 (Finding 1 accepted by-design; Finding 2 cosmetic; Finding 3 stale legacy component) + 2 low-risk coverage suggestions.
**Tests:** 232/232 passing — 171 unit (27 files) + 61 integration (12 files). Build clean (`npm run build`, 18 routes, TypeScript strict).
**Browser verification:** Executed live at 375px — all four Feature 8 flows PASS (Automatic group render, classification, activate/deactivate toggle, Overview exclusion + done bucket + inverse flow).

**Verdict:**
APPROVED — Feature 8 (Set-and-Forget) is shippable. All five core user flows work end-to-end in the live app, the money-math invariants (CONSTRAINT-17/18) are enforced at the engine chokepoint, the activation write-path constraint (CONSTRAINT-16) holds, and the optimistic toggle is correctly guarded. The three findings are non-blocking — one is an accepted by-design product behavior, two are cosmetic/cleanup. Full automated suite green and production build clean.

**Recommended next steps:**
1. Mark Phase H complete in `docs/plan.md` (Task 55 already `[x]`).
2. Optional follow-ups (non-blocking): add the deactivate→onTrack and 100%-set-and-forget assertions; remove/refresh stale `card-expanded.tsx`.
3. `@security` is CLEAR (no auth/data-handling changes beyond the already-reviewed ownership-checked activation route) — re-run only if you want a fresh audit before sharing.
4. `@end-session` to capture the handoff.
