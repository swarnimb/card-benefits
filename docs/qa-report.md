# QA Report

**Date:** 2026-05-21
**Status:** APPROVED — with mandatory live verification (Manual Verification Checklist below)

> **Task 46 — Phase F GATE.** Milestone shippability sign-off after the **Tasks 40–48 defect-fix bundle**. Supersedes the 2026-05-19 APPROVED report, which predates Tasks 40–48. That prior pass closed the milestone after Tasks 29–39 (classification model + Overview redesign + generic scraper). This pass signs off the defect closeout that resolved findings NEW-1 through NEW-10 (7 fixed, 3 deliberately deferred post-MVP).

---

## Defect Bundle Status — NEW-1 … NEW-10

The 2026-05-19 manual verification run surfaced findings NEW-1…NEW-5. Tasks 45/47/48 surfaced NEW-6…NEW-10 during the bundle. Each fix below was verified present in the current codebase, not taken on trust from the plan.

| Finding | Title | Task | Status | Verification |
|---|---|---|---|---|
| NEW-1 | Add Card not transactional — orphan cards on review-gate Cancel | 43 | **CLOSED** | `src/app/(app)/admin/page.tsx` — `freshAddCardId` state set in `handleAddSuccess`; `handleReviewCancel` branches on `isFreshAdd` and issues `DELETE /api/user-cards/{id}`; `CardDeleteFailedError` (`src/lib/errors/card-delete-failed.ts`) thrown loud on non-OK with `userCardId` + status + body. Unit-tested (3 tests in `admin-page.test.tsx`: fresh-add Cancel deletes, re-scrape Cancel no-op, DELETE failure surfaces). |
| NEW-2 | ConfirmDialog Remove button not red (destructive-UX violation) | 40 | **CLOSED** | `src/components/shared/confirm-dialog.tsx` line 46 — `variant={destructive ? "destructive" : "default"}`. `AlertDialogAction` (`src/components/ui/alert-dialog.tsx` line 149–155) forwards `variant` into `Button asChild`, so the destructive token actually renders, not just className intent. Unit-tested in `confirm-dialog.test.tsx`. |
| NEW-3 | ConfirmDialog title stripped issuer (broke for Discover "it") | 41 | **CLOSED** | `src/components/admin/card-management-list.tsx` lines 84–88 — title interpolates `${issuer} ${name}` (Approach B: minimal title fix, no schema denormalization). Reads "Remove Discover it Cash Back?" / "Remove Amex Blue Cash Everyday?". Regression-tested in `card-management-list` test. |
| NEW-4 | Claude Haiku `max_tokens` overflow on content-rich cards | 45 | **CLOSED** | `src/lib/parser/index.ts` line 64 — `max_tokens` raised 4096 → 8192. Line 85–87 — explicit `stop_reason === "max_tokens"` branch throws `ParserError` with a user-actionable message; route surfaces it as `parseError`. Live probe (Sapphire Reserve, 3 scrapes): `output_tokens` 5673/5979/6203, all `stop_reason=tool_use` under the 8192 ceiling. Unit + integration tested. |
| NEW-5 | Cash-back rates misclassified as discretionary-credit | 44 | **CLOSED** | `src/lib/parser/classification.ts` — `detectAutoEarnPatterns` (cash-back % + Nx points/miles regex) drives an `auto-earn` override in `applyClassificationOverride`, wired into `toDraftBenefit` (`parser/index.ts` line 29). Live-verified on Freedom Unlimited re-scrape (rates landed in the auto-excluded section). ~22 classification unit tests. |
| NEW-6 | Amex Platinum scrape returned empty benefits (stale scrape URL) | 47 | **CLOSED** | Root cause = dead Amex `/en-us/credit-cards/...` URL. `data/card-catalog.json` line 48 now carries the working `https://www.americanexpress.com/us/credit-cards/card/platinum/` scheme; the cached `Card` DB row was hand-patched via SQL. Live re-scrape produced 12,043 chars + `output_tokens=3026`, user-confirmed. `[scraper]` gated `debugLog` instrumentation landed in `src/lib/scraper/generic.ts`. |
| NEW-7 | Fresh-add Cancel rollback unreachable after navigation | G1 | **OPEN — accepted, deferred post-MVP (Phase G)** | `AdminPage.freshAddCardId` is React `useState`; lost if AdminPage unmounts mid-scrape. Task 43's fix is correct for the canonical happy path; this is a latent UX gap on top of it. Tracked as Phase G Task G1. Not a blocker — see Findings. |
| NEW-8 | Trials / pay-over-time / discounts misclassified as tracked credits | 48 | **CLOSED** | `src/lib/parser/classification.ts` — `detectTrialPatterns` → `one-time-bonus`, `detectPayOverTimePatterns` → `passive-perk`, `detectDiscountPatterns` (auto-applied + recurring only) → `passive-perk`, dispatched via the priority-ordered `OVERRIDE_RULES` table in `applyClassificationOverride`. Auto-earn is sticky (no weaker keyword downgrades it). ~22 classification unit tests including negative cases. |
| NEW-9 | Catalog→DB sync gap — scrape route reads `Card.scrapeUrl` from DB | — | **OPEN — accepted, deferred post-MVP (architectural)** | The scrape route reads `userCard.card.scrapeUrl` from the `Card` table; the catalog→DB resync runs only inside the add-card flow (`user-cards/route.ts:40-44`). A catalog URL correction does not reach an already-added card — Task 47's fix had to be hand-applied via SQL. Fix = resync `Card.scrapeUrl` at scrape time, or an admin "refresh catalog" action. Not a blocker — see Findings. |
| NEW-10 | Blue Cash Preferred + Everyday carry the dead Amex URL | — | **OPEN — accepted, deferred post-MVP (known fix)** | `data/card-catalog.json` lines 55 + 62 still carry the dead `/en-us/credit-cards/...` scheme — identical root cause to NEW-6/Task 47. Fix is known (correct catalog + both `Card` rows to the `/us/credit-cards/card/...` scheme, verify re-scrape). Deferred to a follow-up task per builder decision 2026-05-21. Not a blocker — see Findings. |

**Closed: 7 (NEW-1, 2, 3, 4, 5, 6, 8). Open by deliberate builder deferral: 3 (NEW-7, NEW-9, NEW-10).** None of the three open items is a blocker — see the Findings section for the rationale on each.

### Observations (informational — not findings)

- **OBS-1 — Task 48 regex backstop has not fired against a live Haiku misclassification.** The tightened classification prompt fixes the trial/pay-over-time/discount cases upstream, so the deterministic `applyClassificationOverride` backstop has had nothing to correct in live runs. This is **not dead code** — it is exercised by ~22 unit tests in `classification.unit.test.ts` and is the intended belt-and-suspenders defense if Haiku regresses. Absent `[classification]` log lines in live runs are the *expected* healthy state, not a coverage gap.
- **OBS-2 — 5 pre-existing `tsc --noEmit` errors in test files.** `add-card-modal.test.tsx` (4× `TS18048 'resp' possibly undefined`) and `setup.ts` (1× `TS2300 duplicate identifier 'ResizeObserver'`). Verified this pass — exactly 5, all in test files, **not introduced by the Tasks 40–48 bundle**. `next build` excludes test files and compiled clean (TypeScript step passed, exit 0). Non-blocking; recommend a standalone cleanup task.
- **OBS-3 — `debugLog` helper is triplicated** across `scraper/generic.ts`, `parser/index.ts`, and `parser/classification.ts`. Each is 5 lines, identical shape. Deferred — recommend a small shared-util extraction task. Non-blocking.

---

## Coverage Assessment

### Critical Paths

- [x] **Auth flows tested:** PASS — `src/__tests__/lib/auth.test.ts` (4 tests): valid credentials, invalid credentials, `requireAuth` with valid JWT, `requireAuth` throwing 401 without a session. NextAuth credentials `authorize()` and the session-gated server helper both exercised.
- [x] **Data write operations tested:** PASS — integration coverage on every write path:
  - `POST /api/benefits/confirm` (`benefits.integration.test.ts`, 10 tests) — replaces benefits + creates periods; `tracked` server-derived from `classification`; client-supplied `tracked` ignored; rejects unknown classification / empty arrays / invalid type.
  - `PATCH /api/benefits/[id]` (`benefit-mutation.integration.test.ts`, 6 tests) — Decision A: client `tracked` + `classification` stripped.
  - `POST /api/usage` (`usage.integration.test.ts`, 3 tests) — all `usedAmount` changes routed through `updateBenefitUsage()`.
  - `POST /api/user-cards`, `DELETE /api/user-cards/[id]` (`user-cards.integration.test.ts`, 6 tests) — CRUD incl. ownership checks.
- [x] **Access control tested:** PASS — cross-user 403 verified across 4 integration files (benefits, benefit-mutation, usage, user-cards). The NEW-1 DELETE path reuses the already-tested `/api/user-cards/[id]` handler with its existing auth + ownership check.
- [x] **Read paths tested:** PASS — `overview.integration.test.ts` (5 tests): urgency-bucket aggregation across cards, `tracked=false` exclusion from every bucket, subscription/access rows as metadata, `needsAttention` sort, 401 unauthenticated.
- [x] **Scrape contract tested:** PASS — `scrape.integration.test.ts` (4 tests): happy path (draft benefits), `ScraperError` → `scrapeError`, `ParserError` → `parseError` (the new NEW-4 `max_tokens` branch), null-URL handled.
- [x] **End-to-end happy path tested:** PASS — `e2e-flows.integration.test.ts` (2 tests): add card → confirm → GET returns confirmed; usage update → Overview reflects new amount.
- [x] **Classification policy + overrides tested:** PASS — `classification.unit.test.ts` (22 tests): `deriveTracked` policy map, conservative-default fallback, `normalizeClassification` allowlist, and the NEW-5 + NEW-8 deterministic overrides (`detectAutoEarnPatterns`, `detectTrialPatterns`, `detectPayOverTimePatterns`, `detectDiscountPatterns`, `applyClassificationOverride`) with positive + negative cases.
- [x] **Scraper pipeline tested:** PASS — `scraper.test.ts` (13 tests): HTTP fast path, Playwright fallback, Readability extraction, auto-scroll/expansion, `ScraperError` shape, source-level invariants.
- [x] **NEW-1 orphan-cancel tested:** PASS — `admin-page.test.tsx` (9 tests): fresh-add Cancel triggers DELETE, re-scrape Cancel does NOT, DELETE failure surfaces a loud error (no silent swallow).
- [x] **NEW-4 max_tokens tested:** PASS — `parser.unit.test.ts` asserts the `stop_reason === "max_tokens"` branch throws `ParserError` with the exact user-actionable message; `scrape.integration.test.ts` asserts the route returns `parseError`.

### Test Summary (verified at QA run — actual numbers, executed this pass)

- **Unit tests:** 134/134 passing across 23 test files (`npx vitest run`). Was 110 at the 2026-05-19 milestone — net +24 from Tasks 40–48.
- **Integration tests:** 42/42 passing across 9 test files (`npx vitest run --config vitest.integration.config.ts`). Was 41 — net +1 (the NEW-4 `parseError` scrape test).
- **Total:** 176 tests, all passing.
- **Build:** `npx next build` exit 0. Compiled in 2.2s, TypeScript step finished clean, 13 static pages generated, all 17 routes emitted. No new warnings.

### Coverage Gaps

- **Login page submitting actual credentials through NextAuth** — unit test still mocks `signIn`. Carried forward from prior QA; not regressed. Non-blocking.
- **Session expiry behavior** — no automated test. Carried forward. Non-blocking.
- **Live browser verification of the 5 fix paths** — cannot be automated this pass (no dev server / browser MCP in this session). Moved to the Manual Verification Checklist below.
- **NEW-7 navigation-loss path** — the latent `useState`-loss gap is a deliberate Phase G deferral; not covered by automated tests (the happy-path NEW-1 fix is). Non-blocking by accepted deferral.

None of these gaps is blocking — auth, data writes, access control, classification policy + the new overrides, the scrape contract incl. the NEW-4 branch, and the canonical end-to-end happy path are all covered by passing automated tests.

---

## Browser Workflow Verification

**No running dev server and no browser MCP tools available in this QA session.** Per the `@qa` agent's Phase-2 fallback rule, automated browser workflow verification cannot run this pass. A **Manual Verification Checklist** is provided below, focused on the 5 fixed-path verifications for the Tasks 40–48 bundle. The main thread will drive live Puppeteer verification with the builder after this report.

**Live verification: PENDING** — see Manual Verification Checklist. APPROVED status holds on the strength of code inspection + the full passing test suite + clean build; the checklist is a confirmation step, not a gate that can flip the verdict unless a step actually fails.

---

## Edge Case Assessment

Verified via automated tests this pass; browser-level edge cases moved to the manual checklist.

- **Scrape failure handling** — PASS (automated). `scrape.integration.test.ts` maps `ScraperError` → `scrapeError` payload.
- **`max_tokens` overflow on content-rich cards** — PASS (automated). `parser.unit.test.ts` confirms the `stop_reason === "max_tokens"` branch throws `ParserError`; `scrape.integration.test.ts` confirms the route returns `parseError`. (NEW-4 fix.)
- **Cash-back rates / trials / pay-over-time / discounts** — PASS (automated). `classification.unit.test.ts` confirms each is overridden to its correct non-tracked bucket, with negative cases ensuring true discretionary credits ($25 dining credit etc.) are NOT misflipped. (NEW-5 + NEW-8 fixes.)
- **Fresh-add Cancel rolls back the orphan card** — PASS (automated). `admin-page.test.tsx` confirms DELETE fires on fresh-add Cancel and is a no-op on re-scrape Cancel.
- **DELETE failure on Cancel** — PASS (automated). `CardDeleteFailedError` thrown loud with context; `admin-page.test.tsx` asserts no silent swallow.
- **Classification not in allowlist / empty benefits / invalid type on confirm** — PASS (automated). `POST /api/benefits/confirm` returns 400.
- **Client overriding server-derived `tracked`** — PASS (automated). Server ignores it on confirm; PATCH strips it.
- **`tracked=false` benefits in Overview** — PASS (automated). `overview.integration.test.ts` asserts none appear in any urgency bucket.
- **Cross-user access** — PASS (automated). 403 across 4 mutation paths.
- **Final scraped content under 200 chars** — PASS (automated). Throws `ScraperError` (CONSTRAINT-10 preserved).
- **NEW-7 navigation-loss orphan** — KNOWN GAP (accepted, Phase G). If the user navigates away from `/admin` during a 30–40s fresh-add scrape, the `freshAddCardId` marker is lost and a subsequent Cancel cannot roll back the orphan. Documented deferral, not a regression.

---

## Findings

### NON-BLOCKING — Live verification of the 5 fix paths pending (no dev server / browser MCP this session)

**Founder Brief**
**Decided:** This QA pass verified the Tasks 40–48 fixes by code inspection and the full automated suite; the live browser walkthrough of the 5 fixed paths will be driven by the main thread with you afterward.
**Means for your product:** The data, persistence, classification, and API contracts are confirmed correct by 176 passing tests + a clean build, and every fix was confirmed present in the actual source. What remains is putting eyes on the rendered result — the red Remove button, the full-name dialog title, the orphan-card cleanup, the FU classification, and a live Sapphire Reserve / Amex Platinum scrape.
**Check before approving:** Walk the Manual Verification Checklist below with `npm run dev` on port 3002. If every step passes, APPROVED is final. If any step fails, document it and re-run `@qa`.
**What this closes off:** Nothing — APPROVED stands; the checklist is a confirmation step.

**What is wrong:** Phase 2 (automated browser workflow verification) could not run — no dev server, no browser MCP in this session.
**What must be done:** Complete the Manual Verification Checklist. Re-run `@qa` only if a step fails.

---

### NON-BLOCKING — NEW-7: fresh-add Cancel rollback unreachable after navigation (accepted, deferred to Phase G / Task G1)

**Founder Brief**
**Decided:** The NEW-1 orphan-card cleanup relies on `AdminPage.freshAddCardId` held in React `useState`. If AdminPage unmounts mid-scrape (user navigates away during the 30–40s fresh-add scrape), that marker is lost, and a later Cancel correctly classifies as a re-scrape no-op — leaving the orphan card in the DB.
**Means for your product:** A narrow UX edge: the orphan-card fix works for the canonical flow (stay on Admin, Cancel) but not if you wander off mid-scrape. Worst case is one stray 0-benefit card you remove manually — no data corruption.
**Check before approving:** N/A — deliberate post-MVP deferral. Tracked as Phase G Task G1 with three candidate fixes (sessionStorage persistence, disable BottomNav during scrape, or accept-and-document).
**What this closes off:** Nothing. Task 43's core NEW-1 fix is sound; this is a latent gap on top of it.

**What is wrong:** `freshAddCardId` lives in component state, which does not survive an unmount.
**What must be done:** Implement Task G1 post-MVP. Not a release blocker.

---

### NON-BLOCKING — NEW-9: catalog→DB sync gap, scrape route reads `Card.scrapeUrl` from DB (accepted, deferred post-MVP — architectural)

**Founder Brief**
**Decided:** The scrape route reads the scrape URL from the `Card` DB table, not from `data/card-catalog.json`. The catalog→DB resync only runs inside the add-card flow, so correcting a URL in the catalog does not reach a card that was already added.
**Means for your product:** When you fix a stale scrape URL in the catalog, existing cards keep scraping the old URL until their `Card` row is updated directly. Task 47's NEW-6 fix had to be hand-applied via SQL for exactly this reason.
**Check before approving:** N/A — accepted architectural deferral. The fix (resync `Card.scrapeUrl` at scrape time, or an admin "refresh catalog" action) is a post-MVP improvement.
**What this closes off:** Nothing today. It makes catalog corrections higher-friction until addressed — worth fixing before Phase 2 / broader card coverage.

**What is wrong:** No catalog→DB resync path outside the add-card flow (`user-cards/route.ts:40-44`).
**What must be done:** Post-MVP — resync `Card.scrapeUrl` from the catalog at scrape time, or add an admin refresh action. Not a release blocker.

---

### NON-BLOCKING — NEW-10: Blue Cash Preferred + Everyday carry the dead Amex URL (accepted, deferred post-MVP — known fix)

**Founder Brief**
**Decided:** `data/card-catalog.json` still has the dead `/en-us/credit-cards/...` Amex URL scheme for Blue Cash Preferred (line 55) and Blue Cash Everyday (line 62) — the identical root cause as NEW-6, which Task 47 fixed for Amex Platinum.
**Means for your product:** Scraping either Blue Cash card today returns empty benefits, exactly like Amex Platinum did pre-Task-47. Neither card currently has benefits in the DB, so nothing visible breaks — but a re-scrape won't populate them until the URL is corrected.
**Check before approving:** N/A — deferred to a follow-up task per your decision 2026-05-21. The fix is fully known: correct the catalog + both `Card` rows to the `/us/credit-cards/card/...` scheme and verify a re-scrape (and it intersects NEW-9 — the `Card` rows must be updated directly, not just the catalog).
**What this closes off:** Nothing. Two cards stay at 0 benefits until the follow-up lands.

**What is wrong:** Two catalog entries (and their `Card` rows) carry the pre-Task-47 dead URL pattern.
**What must be done:** Apply the Task-47 fix pattern to Blue Cash Preferred + Everyday. Small, known change. Not a release blocker. (Note: `data/card-catalog.json` line 41, Amex Gold, also carries the `/en-us/` scheme; Gold is not an owned card but should be corrected in the same follow-up for catalog hygiene.)

---

### NON-BLOCKING — OBS-2: 5 pre-existing `tsc` errors in test files (not introduced by this bundle)

**Founder Brief**
**Decided:** `npx tsc --noEmit` reports 5 type errors — `add-card-modal.test.tsx` (4× `'resp' possibly undefined`) and `setup.ts` (1× duplicate `ResizeObserver`). All in test files, all pre-existing.
**Means for your product:** Zero runtime or build impact. `next build` excludes test files from its TypeScript pass and compiled clean (exit 0, all 17 routes). Tests run green (176/176). This only surfaces if you run `tsc` directly across the whole repo.
**Check before approving:** N/A — doc/chore-only, not introduced by Tasks 40–48.
**What this closes off:** Nothing.

**What is wrong:** Test-file type errors that the build does not see.
**What must be done:** Standalone cleanup task — narrow the `resp` type in `add-card-modal.test.tsx`, dedupe the `ResizeObserver` declaration in `setup.ts`. Low priority.

---

### NON-BLOCKING — OBS-3: `debugLog` helper triplicated (deferred)

**Founder Brief**
**Decided:** An identical 5-line gated `debugLog` helper now exists in three files (`scraper/generic.ts`, `parser/index.ts`, `parser/classification.ts`).
**Means for your product:** No functional impact — purely a small DRY smell. Each copy is correct and identically gated on `DEBUG=true`.
**Check before approving:** N/A.
**What this closes off:** Nothing.

**What is wrong:** Triplicated helper — the Task 45 comment anticipated extraction "at the third consumer," now reached.
**What must be done:** Small shared-util extraction task (e.g. `src/lib/debug-log.ts`). Low priority.

---

### NON-BLOCKING — 28 npm audit advisories (carried from prior QA, partially reduced)

**Founder Brief**
**Decided:** Task 42's Next.js 16.1.6 → 16.2.6 bump closed all 15 HIGH advisories; per the Task 42 record `npm audit` dropped 28 → 11, with 1 residual transitive moderate (`postcss <8.5.10` nested under Next.js, upstream-bound).
**Means for your product:** No runtime exposure for a local-only single-user MVP. The residual moderate is in dev tooling and cannot be closed without an upstream Next.js patch.
**Check before approving:** N/A for MVP. Re-audit before Phase 2 (Vercel migration), where the dependency tree gets internet-exposed.
**What this closes off:** Nothing today. Defers a chore to Phase 2.

**What is wrong:** 1 residual transitive moderate advisory (`postcss` under `next`).
**What must be done:** Re-evaluate at Phase 2 kickoff once Next.js ships an updated nested `postcss`.

---

## Manual Verification Checklist

> **Run with `npm run dev` (port 3002).** Test credentials: `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`. This checklist is scoped to the **5 fixed paths in the Tasks 40–48 bundle** — it is the live confirmation of fixes already verified in code + tests. If any step fails, document the failure and re-run `@qa`.

**Step 1 — NEW-1: orphan-card cleanup on fresh-add Cancel**
- Action: Admin → Add Card → pick a catalog card (ideally one that scrapes cleanly). When the review gate opens, click **Cancel** without confirming. Stay on the `/admin` page throughout (do not navigate away — that is the known NEW-7 gap).
- Expected: The just-added card does **not** appear in the Admin list afterward — the userCard row was DELETEd. Admin count is unchanged from before the add. No console errors. (If the scrape fails into the amber manual-entry fallback, Cancel from there must equally remove the orphan.)
- Screenshot: Admin list before add, and after Cancel (should match).

**Step 2 — NEW-2: red destructive Remove button**
- Action: Admin → click the trash icon on any card. Inspect the ConfirmDialog.
- Expected: The **Remove** button renders with the destructive red background (not white/light). The **Cancel** button is the lighter/secondary style. Hover on Remove shows the `bg-destructive/90` hover state. Verify at both 375px and 1280px.
- Screenshot: ConfirmDialog at 375px and 1280px.

**Step 3 — NEW-3: full card name in remove-dialog title**
- Action: Trigger the remove ConfirmDialog on a card whose name reads awkwardly without the issuer — ideally **Discover it Cash Back** (or any Amex card if Discover isn't present).
- Expected: Title reads "Remove Discover it Cash Back?" (full `issuer + name`), not "Remove it Cash Back?". For Amex cards: "Remove Amex Blue Cash Everyday?" etc.
- Screenshot: ConfirmDialog title for the chosen card.

**Step 4 — NEW-5: Freedom Unlimited cash-back rates classified as auto-earn**
- Action: Admin → re-scrape **Chase Freedom Unlimited**. When the review gate opens, inspect the bucket assignments.
- Expected: The cash-back earn rates (1.5% all purchases, 3% dining/drugstores, 5% Chase Travel) appear in the **auto-excluded** section as `auto-earn` (`tracked: false`) — NOT in the tracked discretionary-credit bucket with usage sliders. Any genuine discretionary credits remain tracked. Optionally also confirm trials / pay-over-time features land excluded (NEW-8). Cancel or Confirm at your discretion.
- Screenshot: Review gate showing the auto-excluded section with the cash-back rates in it.

**Step 5 — NEW-4: max_tokens handling on content-rich cards (Amex Platinum scrape)**
- Action: Admin → re-scrape **Amex Platinum** (NEW-6 fixed its URL — the scrape should now return substantive content). Watch the terminal with `DEBUG=true` if possible for the `[parser] output_tokens=… stop_reason=…` line.
- Expected: Scrape returns substantive benefits into the review gate (the URL fix means it no longer comes back empty), and `stop_reason=tool_use` — no `max_tokens` overflow at the 8192 ceiling. If a future even-denser card *did* overflow, the expected graceful outcome is the `parseError` "Card content exceeds parser capacity, manual entry required" message, not a crash. A crash or hung scrape is a FAIL.
- Screenshot: Review gate populated with Amex Platinum benefits (and the terminal `output_tokens` line if captured).

> Out of scope for this checklist (deferred): NEW-7 navigation-loss orphan (Phase G), NEW-9 catalog→DB sync, NEW-10 Blue Cash URL fix. Do not test these as pass/fail gates — they are accepted open items.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 7 (live-verification pending; NEW-7 / NEW-9 / NEW-10 accepted deferrals; OBS-2 pre-existing tsc errors; OBS-3 debugLog triplication; 1 residual npm audit moderate)
**Tests:** 176/176 passing — 134 unit (23 files) + 42 integration (9 files). Build clean (`next build` exit 0, 17 routes, TypeScript step passed).

**Defect bundle:** NEW-1, 2, 3, 4, 5, 6, 8 **CLOSED** — each fix verified present in source, not taken on trust. NEW-7, NEW-9, NEW-10 **OPEN by deliberate builder deferral (post-MVP)** — none is a release blocker.

**Verdict:**
APPROVED — Phase F GATE passes. The Tasks 40–48 defect-fix bundle is complete and verified: all seven targeted findings (NEW-1…6, 8) are closed in code and behind passing tests, the full suite is green at 176/176, and the production build compiles clean. The three remaining findings (NEW-7, NEW-9, NEW-10) are explicitly accepted post-MVP deferrals — they are documented, root-caused, and non-blocking for a local, single-user, desktop-only MVP. OBS-1 confirms the Task 48 regex backstop is intentionally-quiet tested code, not dead code; OBS-2's 5 tsc errors pre-date this bundle and are invisible to the build.

The product is shippable for MVP once the Manual Verification Checklist above is walked with the dev server running. The checklist is a live confirmation of fixes already verified at the code + test layer — APPROVED holds unless a checklist step actually fails, in which case document it and re-run `@qa`.

**Recommended next steps:**
1. Main thread drives the 5-step Manual Verification Checklist with the builder (live Puppeteer).
2. If all steps pass, mark Task 46 GATE complete and Tasks 40–48 closed in `docs/plan.md`.
3. Open follow-up tasks for NEW-9 + NEW-10 (and optionally NEW-7 / OBS-2 / OBS-3) — none blocks launch.
4. Run `@launch-prep` once the checklist passes (the prior `@security` re-run for this bundle is Task 46's other half).
