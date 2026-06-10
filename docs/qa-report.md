# QA Report

**Date:** 2026-06-09
**Status:** APPROVED

> **Feature 10 — Usage Accuracy & In-Place Logging sign-off (Tasks 67–73).** Shippability assessment for per-window benefit values (CONSTRAINT-24), Overview inline usage logging, the per-window review-gate amount label, and the Cards visible/hidden split. **Supersedes the 2026-06-07 Feature 9 APPROVED report** (Tasks 56–66, retained in git history). Phase 2 browser verification was executed live via DevTools Puppeteer against `http://localhost:3002` at **both 375px and 1280px** (CONSTRAINT-23), with hybrid manual login and non-destructive verification (all mutations reverted; no review-gate confirm).

> **⚠ A blocking runtime crash was found AND fixed during this gate** (review gate / admin flow ErrorBoundary, Framer Motion easing). It was a **latent Feature 9 bug**, not a Feature 10 regression — see Finding 1. It is fixed, re-verified live at both viewports, and the production build is clean. **The fix is uncommitted at time of writing** (see Follow-ups).

---

## Scope

Feature 10 (Tasks 67–73): per-reset-window `value` parsing + Haiku schema semantics (CONSTRAINT-24), non-destructive `scripts/audit-benefit-values.ts` + the Hotel Credit $600→$300 correction, the Overview `useOverviewData` hook (optimistic usage write + recompute + revert-on-failure), tap-to-expand Overview rows with inline usage controls, days-left on every Overview row, the per-window review-gate amount label (`BenefitAmount` in `edit-fields.tsx`), and the Cards visible/hidden benefit split with eye toggles. Reviewed against `rules/testing-standards.md` (TS-01/TS-04) and `docs/constraints.md`.

Verification split: Phase 1 (code + coverage) and the root-cause investigation were run by subagents; the QA authority drove **all** live browser verification (375 + 1280) and the targeted-fix re-verification in person.

---

## Coverage Assessment

### Critical Paths
- [x] Auth flows: **PASS** — server-side gate `app/(app)/layout.tsx:12` redirects unauthenticated → `/login` (verified live: fresh browser → login required). `lib/auth.ts` credential + JWT path unchanged from Feature 9 (covered).
- [x] Payment flows: **N/A** — no payment surface.
- [x] Data write operations: **PASS** — `updateBenefitUsage()` remains the sole sanctioned `usedAmount` writer (CONSTRAINT-07), covered by `usage.integration.test.ts` (happy + clamp-high + clamp-to-0 + non-existent-ID error + set-and-forget rejection). Overview optimistic write + revert-on-POST-failure covered by `use-overview-data.test.ts`. Review-gate save path (`tracked` override on confirm) unchanged + covered.
- [x] Access control: **PASS** — `tracked` eye-toggle (PATCH `/api/benefits/[id]`) and usage POST both route through `requireAuth`; section-move verified live (hidden 17→16→17).

**Per-window parsing (CONSTRAINT-24):** `unusedFromParts` covered by 5 unit tests in `expiring.unit.test.ts` (subscription-claimed/unclaimed, null/unlimited, normal cap, floor-at-0). Classification→`tracked` mapping covered by 28 tests in `classification.unit.test.ts` (incl. A10 conservative default).

**Audit script:** `scripts/audit-benefit-values.ts` confirmed non-destructive by default (dry-run prints `(DRY-RUN — no DB writes performed)`; writes only `Benefit.value` and only under explicit `--apply`, wrapped in `$transaction`; never touches `usedAmount` or `BenefitPeriod`, CONSTRAINT-08). `flagBenefit` heuristic unit-tested.

**Test suite:** **247/247 unit + component green** (`npx vitest run`, 38 files, 0 failures) — incl. 2 new assertions added by the Finding-1 fix. **`tsc --noEmit` clean.**
**Build:** `npm run build` — **PASS** (Next.js 16.2.6 / Turbopack, TypeScript clean, all 14 routes resolved). Re-run a second time after the Finding-1 fix — still clean.

### Coverage Gaps
1. **`updateBenefitUsage` tests are integration-only** (`*.integration.test.ts`) and excluded from `npx vitest run` (need a DB). They pass under `npm run test:integration` (67 integration tests per handoff) but were not re-executed this gate. NON-BLOCKING (sanctioned write path is well-covered).
2. **Audit script `--apply` write branch is not unit-tested** — gated behind an explicit flag and `$transaction`. NON-BLOCKING.
3. **No automated test catches the Finding-1 class of bug** (CSS-string easing passed to a Framer `ease` prop throws only at runtime; `tsc` and the build do not catch it). See Finding 1 → recommended guard. NON-BLOCKING but notable.

---

## Browser Workflow Verification

All flows verified live at **375px AND 1280px** (CONSTRAINT-23). Evidence screenshots captured: `f10-overview-375-fresh/expanded`, `f10-overview-1280`, `f10-cards-375-detail`, `f10-cards-1280-detail`, `f10-task68-reviewgate-375`, `f10-reviewgate-1280`.

### Overview (`/overview`) — Tasks 71 + 72
**Result:** PASS (375 + 1280)
**Observed:** Rows collapsed by default (controls hidden). Tapping a row expands an inline usage control (credit→slider + numeric input, fits the column); opening a second row collapses the first (single-open enforced, verified by `aria-expanded` state). Every open-period row shows days-left ("· 206d", muted; amber when urgent) — 19/23 credits carry a non-null `daysUntilReset` and all render. No ErrorBoundary, no bad-value strings.
**CONSTRAINT-23:** `main` = 420px wide, centered (left 422 / right 438 at 1280); the **fixed BottomNav is constrained to the same 420px column** (width 420, not full-bleed).

### Cards (`/cards`) — Task 73
**Result:** PASS (375 + 1280)
**Observed:** Wallet stack + portfolio stat trio render. Opening a card detail shows only `tracked` benefits in the main list; untracked collapse into a single "N HIDDEN — TAP TO EXPAND" row (Amazon Prime Visa: all 17 untracked → empty visible list + "17 HIDDEN", correct for an all-auto-earn card). Expanding reveals 17 eye toggles (`aria-label="Toggle tracked"`). **Eye toggle moves a benefit between sections live** (hidden 17→16 on track, →17 on revert — reverted to leave DB clean).
**CONSTRAINT-23:** card-detail uses a `fixed inset-0` scrim (full-screen backdrop — correct), but its **content stays in the centered 420px column** at 1280 (no full-bleed sprawl).

### Admin → Review Gate (`/admin` scrape) — Task 68 + the Finding-1 crash
**Result:** PASS (375 + 1280) **after Finding-1 fix**
**Steps:** Triggered a live re-scrape of the Amex Platinum Card (server-side scrape + Haiku parse returns 200 OK with 17 parsed benefits — confirmed by direct endpoint call). Reached the review gate. **Discarded without confirming — no DB write.**
**Observed (pre-fix):** Review gate, scan animation, and add-card flow **crashed to the app ErrorBoundary** ("Something went wrong") — see Finding 1.
**Observed (post-fix, both viewports):** Scan animation renders, then the review gate renders cleanly (0 captured errors). **Task 68 per-window labels correct** across windows: "$300 **per 6 months**" (semiannual), "$200/$209/$120 **per year**" (annual), "$100 **per quarter**" (quarterly). Mandatory review banner present ("Nothing is saved until you do", CONSTRAINT-10). Modal content centered in the ~420px column at 1280 (left 450 / right 467).

### Auth
**Result:** PASS — a fresh Puppeteer browser (no cookie) is redirected to `/login`; manual credential login grants the JWT session. Each browser relaunch (viewport change) correctly re-required login.

---

## Edge Case Assessment

- **Optimistic-write revert:** covered by `use-overview-data.test.ts` (POST failure → "Failed to update usage" → state reverts). Live usage write not destructively re-tested this gate (covered by Feature 9 live test + this suite).
- **All-untracked card:** Amazon Prime Visa (17/17 untracked) renders an empty visible list + a single hidden row — no empty-state crash.
- **Set-and-forget on Overview:** rendered info-only (no usage control) per CONSTRAINT-17 (code-verified `loggable = !c.setAndForget`).
- **LLM parse variance (NON-BLOCKING, A10):** across two scrapes the Haiku parse labeled Uber Cash as "$200/year" then "$180/year" with a per-window note — a known parse-accuracy risk the **mandatory review gate exists to catch**, not a Feature 10 defect. Discarded unsaved.

---

## Findings

### RESOLVED (was BLOCKING) — Finding 1: Review gate / admin flow crashes to ErrorBoundary (invalid Framer Motion easing)

> **Resolution (2026-06-09):** Fixed via `@dev` targeted-fix mode. Added `EASING_ARRAY = [0.34, 1.2, 0.64, 1]` and `EASING_MODAL_ARRAY = [0.34, 1.1, 0.64, 1]` to `src/lib/ui/tokens.ts` (the CSS-string `EASING`/`EASING_MODAL` are retained for real CSS transitions) and repointed all 9 Framer `transition.ease` usages to the array form: `toast.tsx`, `benefit-edit-row.tsx`, `benefit-edit-panel.tsx`, `delete-confirm.tsx`, `flow-shell.tsx` (modal), `excluded-disclosure.tsx` (×2), `catalog-row.tsx`, `scan-card-visual.tsx`. Added 2 token assertions to `tokens.test.ts`. `tsc` clean, 247/247 tests pass, build clean. **QA authority re-verified live: review gate + scan + add-card render with 0 errors at both 375 and 1280.** Closed.

**Founder Brief**
**Decided:** The review gate — the *only* way benefit data enters the app — was crashing to a generic "Something went wrong" screen on every scrape and add-card, along with the scan animation, delete-confirm, and toasts.
**Means for your product:** Before the fix, you could not add a card or re-scrape benefits at all. Overview and Cards (daily use) worked, but the entire data-entry path was dead.
**Check before approving:** Scrape a card and confirm the review gate renders and you can save — done, verified live at both viewports.
**What this closes off:** Nothing — mechanical fix (array-form easing constants).

**What was wrong:** `EASING = "cubic-bezier(0.34, 1.2, 0.64, 1)"` (a CSS easing **string**, `tokens.ts:112`) was passed into Framer Motion's `transition.ease` prop in 9 components. framer-motion v11 (11.18.2 installed under the `^11.0.0` range) **hard-throws `Invalid easing type`** on CSS-string easings — it requires an array `[0.34, 1.2, 0.64, 1]`. `flow-shell.tsx:47` wraps the whole admin flow, so it threw before the gate mounted.
**Origin (important):** Git history confirms every `ease: EASING` line was introduced in **Feature 9** (Task 65 admin rebuild + the Feature 9 code-review commit). **Feature 10 did not add or modify any easing line.** framer-motion v11 always rejected CSS-string easings, so this shipped **latent in Feature 9** and was never hit at runtime until the review gate was actually opened in this gate. **Feature 9's QA (2026-06-07) verified at 1280 but explicitly triggered no scrape** ("No scrape triggered — non-destructive policy"), which is why it was missed.
**Recommended guard (NON-BLOCKING):** add a lint rule or a unit test asserting no `ease:` prop receives a `cubic-bezier(` string, so this runtime-only class of bug is caught by CI.

### NON-BLOCKING — Finding 2: Feature 10 fix is uncommitted

**What is wrong:** The Finding-1 fix (9 components + `tokens.ts` + `tokens.test.ts`) and these QA/plan/manifest doc updates are uncommitted in the working tree.
**What must be done:** Commit to `main` (solo-dev convention). The fix is small, mechanical, tested, and build-verified.

### NON-BLOCKING — Finding 3: Framer-easing bug class is invisible to tsc/build

**What is wrong:** Coverage Gap 3 — a CSS-string easing passed to a Framer `ease` prop type-checks and builds fine; it only throws at render. There may be no other instances now, but nothing prevents reintroduction.
**What must be done:** Add the lint/unit guard from Finding 1's recommendation when convenient.

### NON-BLOCKING — Finding 4: LLM parse accuracy on per-window values (A10)

**What is wrong:** A live scrape labeled a $15/month credit as an annual figure. Accepted risk A10; the mandatory review gate is the mitigation (user corrects before save).
**What must be done:** Nothing required — working as designed. Watch parse quality over time.

---

## Summary

**Blocking issues:** 0 (1 found, 1 fixed + re-verified live)
**Non-blocking issues:** 3

**Verdict:**
**APPROVED** — Feature 10 (Tasks 67–73) is shippable. All four Feature 10 UI deliverables (per-window amount label, tap-to-expand inline logging, days-left rows, visible/hidden split) verified live at **375px AND 1280px**; CONSTRAINT-23 holds on every screen incl. fixed nav and overlays; 247/247 unit tests green; `tsc` clean; production build clean (twice). The one blocking finding — a **latent Feature 9** review-gate crash surfaced by this gate's live scrape — was fixed, re-verified live at both viewports, and build-confirmed. Three non-blocking items remain (commit the fix, add an easing guard, monitor parse accuracy).

**Required / recommended follow-ups:**
- **Commit the fix + docs to `main`** (Finding 2) — required to persist the fix.
- **Run `@security`** — Feature 10 is still owed a security gate (new usage-write surface + audit script); the existing security report is Feature-9-scoped. The Finding-1 fix is UI-only (no auth/data-handling change).
- Add an easing-guard test/lint (Finding 3) when convenient.
- **Process note:** Feature 9's "APPROVED" did not exercise the review gate. Future feature QA must trigger at least one live scrape so the data-entry path is covered.
