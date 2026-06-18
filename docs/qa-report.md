# QA Report

**Date:** 2026-06-17
**Feature:** 11 — Manual Benefit Management (Phase K, Tasks 79–86) + the post-code-review fixes (commit `3aae27d`)
**Status:** APPROVED

> Supersedes the 2026-06-12 Feature 10.1 QA report (retained in git history). Scopes the Feature 11 delta. Builds on: `@code-review` PASS + `@security` CLEAR (2026-06-17, commit `3aae27d`).

---

## Coverage Assessment

### Critical Paths
- [x] Auth flows tested: **PASS** — POST /api/benefits 401-unauthenticated asserted (no row written). PATCH/DELETE auth is the shared `[id]` handler (pre-existing, covered).
- [x] Payment flows tested: **N/A** — no payment surface.
- [x] Data write operations tested: **PASS** — Create / Edit / Delete each have happy + error integration tests (`benefit-create.integration.test.ts`, `benefit-mutation.integration.test.ts`). 90 integration + 322 unit green.
- [x] Access control tested: **PASS** — 401 / 403 (IDOR, asserts the row is NOT mutated) / 404 covered on the write verbs.

### Coverage Gaps (non-blocking)
- Task-82 "value stored verbatim" has no dedicated automated assertion (create tests assert the POST body + that an open period is created, but don't re-read `persisted.value`). **Mitigated:** live-verified this session — `value:40` (create) and `value:215` (edit) both confirmed stored verbatim via the API.
- PATCH 401 and PATCH 404 not independently asserted (shared `[id]` handler; DELETE covers the 403/404 branches). Low risk.

---

## Browser Workflow Verification

Driven live via DevTools Puppeteer at **375px** against **real Amex Platinum data** (builder-authorized; data restored to clean state afterward). This is the most thorough Phase-2 mode (full mutation re-run), re-proving Task 86's verification *after* the code-review fixes.

### Add a manual benefit
**Result:** PASS
**Steps:** Admin → expand Amex Platinum → "+ Add benefit" → name `QA Verify Credit`, $40, credit/monthly/general → Save.
**Verified (API):** persisted `source:"manual"` (server-forced), `value:40` verbatim, `currentPeriod {status:"open", usedAmount:0}` created, `tracked:true`, `classification:"discretionary-credit"` derived server-side. Save button correctly disabled until name+amount valid; AMOUNT label dynamically read "PER MONTH" (CONSTRAINT-24).

### Edit a scraped benefit → source pin
**Result:** PASS
**Steps:** Inline Edit on `$209 CLEAR+ Credit` (pre-state `source:scraped`, value 209) → value → 215 → Save changes.
**Verified (API):** same benefit id, `value 209→215`, **`source` flipped `scraped→manual`** (CONSTRAINT-27 edit-pin), edited in place (not recreated).

### Delete a benefit
**Result:** PASS
**Steps:** Inline Delete on `QA Verify Credit` → inline confirm ("usage history will be permanently removed", Keep / Delete benefit) → Delete benefit.
**Verified (API):** benefit gone, count 18→17, period cascade-removed (no orphan).

### Re-scrape pinning (headline)
**Result:** PASS
**Steps:** Re-scrape Amex Platinum (live HTTP + Haiku) → review gate (11 tracked + 6 auto-excluded = 17 fresh) → "Save 17 benefits".
**Verified (API):** 18 total = **17 fresh scraped + 1 pinned manual**; the edited CLEAR+ (exact id, `$215`, manual) **survived the replace-all** while scraped rows were replaced; the expected duplicate (manual `$215` + fresh scraped `$209`) appeared. Annual-headline detector + parser hardening confirmed live (Walmart+ re-parsed `$155`→`$12.95/mo`).

### Fix-regression check (component splits + enum extraction)
**Result:** PASS — the 3 extracted subcomponents render and function in the live UI: `AddBenefitActions` (Cancel/Save), `TextButton` (inline Edit/Delete), `IconButton` (card-header expand/re-scrape/delete). The consolidated `benefit-enums` validation rejected nothing valid and the flows behaved identically to Task 86.

**Screenshots:** qa-01 login → qa-02 overview → qa-03/04 admin+Platinum → qa-05 managed panel → qa-07/08/09 Add form → qa-10 added → qa-11/12 Edit → qa-13 delete-confirm → qa-15 review gate → qa-16 restored overview.

---

## Edge Case Assessment

- Empty-name guard: Save disabled until valid (observed the amber Save brighten on valid input).
- Per-window semantics: AMOUNT label switches PER MONTH/YEAR by reset; roll-up renders for manual benefits too (`$40/mo → $480/yr`).
- Duplicate after edit+re-scrape: handled as designed (no silent auto-dedup) — known/accepted behavior.

---

## Findings

### NON-BLOCKING — Task-82 verbatim-`value` lacks an automated assertion
**Founder Brief**
**Decided:** The "manual value is stored exactly as typed (per-window, not annualized)" guarantee is proven live but not pinned by an automated test.
**Means for your product:** No user impact today — it works. Risk is only future regression slipping past CI.
**Check before approving:** Confirm the live result (value 40 and 215 stored verbatim) is acceptable evidence for now. (It is.)
**What this closes off:** Nothing.
**What is wrong:** No integration test re-reads `Benefit.value` after create to assert it equals the submitted per-window figure.
**What must be done:** Add a one-line assertion in `benefit-create.integration.test.ts` in a future cleanup. Not a release blocker.

### NON-BLOCKING — Desktop 1280px not re-verified this session
CONSTRAINT-23 (centered `max-w-[420px]` column at 1280px) was not re-checked — a viewport change forces a Puppeteer re-login. Unchanged by Feature 11 (an Admin inline feature with no layout change) and verified in prior Feature 9/10 QA. Carried forward.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 2

**Verdict:** **APPROVED** — Feature 11 (Manual Benefit Management) is shippable. All four core flows (Add / Edit-pin / Delete / re-scrape pinning) verified live at 375px on real data, post-fixes; critical-path test coverage (data writes + access control) is in place; the code-review fixes introduced no regression. The two non-blocking items are documentation/coverage hygiene, not functional defects.
