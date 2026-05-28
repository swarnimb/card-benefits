# Known Issues: CardMaxxer

> Consolidated list of known bugs, limitations, and accepted risks at launch.
> Updated: 2026-05-27 — Task G4 (scrape overlay) shipped, resolving NEW-7 (overlay blocks nav mid-scrape) and superseding Task G1; category-400 bug fixed (parser clamp + confirm coerce); OBS-4 logged (category list duplicated across ~6 sites).

---

## Status

MVP is gate-cleared. All 48 MVP tasks (Phases A–F) are complete; Phases G and H are deferred post-MVP and tracked in `docs/plan.md`.

- **QA:** APPROVED — `docs/qa-report.md` (2026-05-21). 176/176 tests passing, clean build, 0 blocking issues.
- **Security:** CLEAR — `docs/security-report.md` (2026-05-21). 0 Critical / 0 High / 0 Medium / 6 Low.
- **Blocking issues:** 0.
- **Open non-blocking items:** 11 — 2 deferred defects (NEW-10 code+data complete, live verification pending; NEW-11 pre-existing statement-anchor bug, low priority), 3 code-quality observations (OBS-2, OBS-3, OBS-4), 6 security Lows (listed below). NEW-7 resolved 2026-05-27 by Task G4.

---

## Open Defects — deferred post-MVP

Three defects surfaced during the Tasks 40–48 bundle were deliberately deferred. None blocks release; all are root-caused. NEW-9 closed by Task G2 on 2026-05-25. NEW-10 code+data complete on 2026-05-25 (Task G3 partial), live re-scrape verification pending. Detail and founder briefs in `docs/qa-report.md`.

### NEW-7 — Fresh-add Cancel rollback unreachable after navigation ✅ RESOLVED 2026-05-27 (by Task G4)
- **What:** `AdminPage.freshAddCardId` is held in React `useState`. If the user navigated away from `/admin` during the 30–40s fresh-add scrape, the marker was lost and a later Cancel could not roll back the orphan card.
- **Impact:** Low. Narrow UX edge — worst case one stray 0-benefit card, removable manually. No data corruption.
- **Fix:** Task G4 — the scrape progress overlay is full-screen and non-dismissible, sitting above the bottom nav (z-[60] > z-50). The user can no longer navigate away mid-scrape, so the orphan path is structurally unreachable. This superseded Task G1's planned sessionStorage fix (`docs/plan.md` Task G1 → `[~]`). Accepted tradeoff: the overlay is the sole protection; no sessionStorage backstop was added.

### NEW-9 — Catalog→DB sync gap ✅ CLOSED 2026-05-25
- **What:** The scrape route read `Card.scrapeUrl` from the DB. The catalog→DB resync ran only in the add-card flow, so correcting a URL in `data/card-catalog.json` did not reach an already-added card.
- **Impact:** Low. Catalog URL corrections had to be hand-applied via SQL to existing `Card` rows (as Task 47 required). Maintenance friction only — no user-facing break.
- **Fix:** Task G2 — new `src/lib/catalog/resync.ts` helper called from the scrape route before each scrape. Catalog → Card sync direction only; CONSTRAINT-04 preserved. Sync failure logs `[catalog-resync] …` and returns the input unchanged, never blocks the scrape.

### NEW-10 — Blue Cash Preferred + Everyday carry the dead Amex URL
- **What:** `data/card-catalog.json` still has the dead `/en-us/credit-cards/...` Amex URL scheme for Blue Cash Preferred and Blue Cash Everyday (Amex Gold too) — same root cause as NEW-6, fixed for Amex Platinum in Task 47.
- **Impact:** Low. Scraping either Blue Cash card returns empty benefits. Neither card has benefits in the DB today, so nothing visible breaks; a re-scrape won't populate them until the URLs are corrected. Intersects NEW-9 — the `Card` rows must be updated directly, not just the catalog.
- **Tracked:** `docs/plan.md` — Phase G, Task G3. Catalog + `Card` rows corrected on 2026-05-26 (commit `bfb6292`); AC 3 (live re-scrape returns substantive content) pending user verification during populate resumption.

### NEW-11 — calcStatementBoundary is monthly-only (pre-existing)
- **What:** `src/lib/engine/periods.ts:calcStatementBoundary` produces month-long windows regardless of `resetPeriod`. The `quarterly+statement` and `annual+statement` combinations therefore silently produce monthly period windows — wrong cadence.
- **Impact:** Low. Statement-anchored quarterlies and annuals are uncommon — most quarterly benefits are calendar-anchored (e.g. Sapphire Reserve $300 travel = calendar year). Discovered while implementing semiannual support 2026-05-26; pre-existing bug, NOT introduced by today's work.
- **Tracked:** Phase G follow-up. Fix: make `calcStatementBoundary` honor `resetPeriod` (or split into `calcMonthlyStatement`, `calcQuarterlyStatement`, `calcAnnualStatement`).

---

## Code-Quality Observations — non-blocking

From `docs/qa-report.md`. No functional impact; recommended as standalone cleanup tasks.

### OBS-2 — 5 pre-existing `tsc` errors in test files
`npx tsc --noEmit` reports 5 type errors — `add-card-modal.test.tsx` (4× `'resp' possibly undefined`) and `setup.ts` (1× duplicate `ResizeObserver`). All in test files, all pre-date the Tasks 40–48 bundle. `next build` excludes test files and compiles clean; tests run 176/176 green. Surfaces only when `tsc` is run directly across the repo. Low priority.

### OBS-3 — `debugLog` helper triplicated
An identical 5-line `DEBUG`-gated `debugLog` helper exists in `scraper/generic.ts`, `parser/index.ts`, and `parser/classification.ts`. A small DRY smell, no functional impact. Fix: extract to a shared util (e.g. `src/lib/debug-log.ts`). Low priority.

### OBS-4 — Valid-category list duplicated across ~6 sites
The 6 valid benefit categories (`dining`, `travel`, `streaming`, `shopping`, `lounge`, `general`) are declared independently in: the `BenefitCategory` type union (`src/types/benefit.ts`), the LLM tool schema enum (`src/lib/parser/schema.ts`), the parser clamp (`src/lib/parser/index.ts`), the confirm-route validator (`src/app/api/benefits/confirm/route.ts`), the PATCH-route validator (`src/app/api/benefits/[id]/route.ts`), and the review-gate dropdown options (`src/components/admin/benefit-edit-row.tsx`). This divergence-prone duplication was the latent cause of the 2026-05-27 category-400 bug (parser passed through what the validator rejected). Fix: derive all sites from one shared `const` (and a shared `normalizeCategory`). Low priority. Note: confirm route now *coerces* unknown categories to `general` (logged), PATCH route still *rejects* — intentional asymmetry (PATCH only receives constrained dropdown values).

---

## Security — Active Low Findings

Six Low-severity findings, all non-blocking for a local-only single-user MVP. Security status is CLEAR. Full detail and founder briefs in `docs/security-report.md`.

| ID | Issue | Location | Disposition |
|---|---|---|---|
| LOW-3 | Plaintext admin password | `src/lib/auth.ts:10` | Accepted exception (CONSTRAINT-14). Revisit at Phase 2. |
| LOW-6 | 404-vs-403 resource enumeration, GET benefits | `src/app/api/user-cards/[id]/benefits/route.ts:29–30` | Negligible single-user. Phase 2 — collapse to uniform 404. |
| LOW-9 | Timing side-channel in `authorizeUser()` | `src/lib/auth.ts:9–10` | Negligible local-only. Must fix before Phase 2 Vercel migration. |
| LOW-10 | 404-vs-403 enumeration, POST usage | `src/app/api/benefits/[id]/usage/route.ts:27–30` | Negligible single-user. Phase 2 fix. |
| LOW-11 | `scripts/` has no usage README | `scripts/` | Operational hygiene, not security. Add `scripts/README.md`. |
| LOW-12 | Transitive `postcss <8.5.10` in `next@16.2.6` | `node_modules/next/…/postcss` | Build-time only, no exploit path. Upstream-bound (GHSA-qx2v-qp2m-jg93). |

---

## Dependency Advisories

`npm audit` reports 11 moderate advisories — **0 loaded at production runtime.** All are build-time (`next`/`postcss` — see LOW-12), test-time (vitest stack), or tooling (Prisma CLI, etc.). Zero threat-model risk on a local-only single-user MVP. Re-triage at Phase 2 (Vercel) kickoff. Detail in `docs/security-report.md`.

---

## Accepted Risks — from `docs/assumptions.md`

Risks accepted during planning. Six total (A2, A3, A6, A7, A9, A10) — full text in `docs/assumptions.md`. A9 = Vercel deployment deferred to Phase 2. The product-facing risks:

### A2 — Reset anchor may not be stated in scraped text
Default is `calendar` for all scraped benefits; the user corrects via the review gate or Admin edit. Display accuracy only — not data integrity.

### A3 — Playwright may be blocked by some issuers
Discover and Amex carry bot-detection risk. The review gate surfaces scrape failure with a manual-entry fallback.

### A6 — Manual usage-entry habit may not form
The app still delivers value as a benefit reference without usage tracking; expiring-soon alerts drive re-engagement.

### A7 — Framer Motion scroll-snap not validated on mobile
Deferred to Phase 2 (Vercel deployment). Fallback: tap-to-focus if the scroll-driven scale is janky.

---

## Limitations — by design

- Re-scraping a card **replaces all benefits and resets usage history** (CONSTRAINT-06).
- No usage history across re-scrapes — "how much did I use last month?" is not answerable after a re-scrape.
- Scraping runs synchronously in the API route — blocks for 15–30s (CONSTRAINT-02).
- Card catalog is managed via JSON file edit, not the Admin UI (CONSTRAINT-04).
- Single user only — no multi-user support without a schema migration (CONSTRAINT-05).

---

## Documentation Drift — minor

- `CLAUDE.md` project-docs table lists `docs/plan.md` as "38 tasks"; the plan now has 58 (48 MVP + 3 Phase G + 7 Phase H). Stale label only — no functional impact.
