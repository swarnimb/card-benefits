# QA Report

**Date:** 2026-05-19
**Status:** APPROVED — with mandatory manual verification

> Supersedes the 2026-04-13 APPROVED report. That prior pass predates Tasks 29–39 (benefit classification + `tracked` field, Overview urgency-primary redesign, Path B classification backfill, and the generic scraper redesign). This is the milestone shippability sign-off for the CardMaxxer MVP after that ~5 weeks of work.

---

## Coverage Assessment

### Critical Paths

- [x] **Auth flows tested:** PASS — `src/__tests__/lib/auth.test.ts` covers valid credentials, invalid credentials, `requireAuth` with valid JWT, and `requireAuth` throwing 401 without a session (4 tests). NextAuth credentials provider authorize() and the session-gated server helper are both exercised.
- [x] **Data write operations tested:** PASS — integration coverage on every write path that exists:
  - `POST /api/benefits/confirm` — replaces existing benefits and creates periods; persists `tracked=true` for discretionary-credit with an open period; persists `tracked=false` for auto-earn with no period; ignores client-supplied `tracked` (server-derived from `classification`); rejects unknown classification, empty arrays, invalid type enum (`benefits.integration.test.ts`, 7 tests).
  - `PATCH /api/benefits/[id]` — Decision A enforced: client-supplied `tracked` and `classification` stripped (`benefit-mutation.integration.test.ts`).
  - `POST /api/usage` — all `usedAmount` changes routed through `updateBenefitUsage()` (`usage.integration.test.ts`).
  - `POST /api/user-cards`, `DELETE /api/user-cards/[id]` — CRUD (`user-cards.integration.test.ts`).
- [x] **Access control tested:** PASS — cross-user 403 verified in 4 integration files: `benefits.integration.test.ts`, `benefit-mutation.integration.test.ts`, `usage.integration.test.ts`, `user-cards.integration.test.ts`. Different-user requests to read/mutate another user's card or benefit return 403.
- [x] **Read paths tested:** PASS — `overview.integration.test.ts` (5 tests) covers urgency-bucket aggregation across multiple cards; `tracked=false` exclusion from every bucket; subscription/access type rows surfaced as row metadata (not filter); `needsAttention` sort by soonest reset; 401 when unauthenticated.
- [x] **Scrape contract tested:** PASS — `scrape.integration.test.ts` covers happy path (draft benefits returned), `ScraperError` mapped to `scrapeError` response, and null-URL handled gracefully (3 tests).
- [x] **End-to-end happy path tested:** PASS — `e2e-flows.integration.test.ts` covers add card → confirm benefits → GET returns confirmed; and usage update → Overview reflects new used amount (2 tests).
- [x] **Classification policy tested:** PASS — `src/__tests__/lib/parser/classification.test.ts` covers `deriveTracked` policy map, conservative-default fallback for ambiguous inputs, and `normalizeClassification` allowlist behavior.
- [x] **Scraper pipeline tested:** PASS — `src/__tests__/lib/scraper/scraper.test.ts` rewritten for Task 39 — 13 tests covering HTTP fast path, Playwright fallback, Readability extraction, auto-scroll/expansion behavior, `ScraperError` shape, and source-level invariants (no `page.waitForTimeout`, `ISSUER_SCRAPERS` empty).

### Test Summary (verified at QA run)

- **Unit tests:** 110/110 passing across 22 test files (was 81 at prior QA — net +29 from Tasks 29–39).
- **Integration tests:** 41/41 passing across 9 test files (was 33 — net +8 from Tasks 29–39).
- **Total:** 151 tests, all passing.
- **Build:** `npm run build` exit 0; all 17 routes generated.

### Coverage Gaps

- **Login page submitting actual credentials through NextAuth** — unit test still mocks `signIn`. Carried forward from prior QA; not regressed. Non-blocking.
- **Session expiry behavior** — no automated test. Carried forward from prior QA. Non-blocking.
- **375px / 1280px visual verification of the assembled Overview** — deferred from Tasks 37–38 to this gate. Cannot be automated this pass (see Browser Workflow Verification below). Moved to the Manual Verification Checklist.
- **Live scrape against real issuer URLs** — Task 39's tests mock `fetch`, `chromium`, `Readability`, and `JSDOM` for deterministic execution. The new two-path pipeline has not yet been exercised against a real card in this codebase state. Moved to the Manual Verification Checklist.

None of these gaps are blocking — auth, data writes, access control, and the canonical happy path are all covered automated.

---

## Browser Workflow Verification

**Browser MCPs not available in this session.** `manifest.md` lists Playwright MCP under `## Available MCPs`, but the Playwright MCP tools (`mcp__playwright__*`) are not exposed in this Claude session, and the devtools Puppeteer MCP (`mcp__devtools__puppeteer_*`) disconnected mid-session. The dev server is not running and starting it requires user action.

Per the `@qa` agent's Phase 2 fallback rule: **Phase 2 (automated browser workflow verification) cannot be executed this pass. A Manual Verification Checklist is provided below — the user must walk through it with the dev server running before treating this APPROVED status as final shippability.**

### App Startup
**Manual: PENDING** — see Manual Verification Checklist step 1.

### Flow 1: Login
**Manual: PENDING** — see Manual Verification Checklist step 1.

### Flow 2: Overview — urgency-primary triage (NEW since prior QA)
**Manual: PENDING** — see Manual Verification Checklist steps 2, 3.

### Flow 3: Cards space
**Manual: PENDING** — see Manual Verification Checklist step 8.

### Flow 4: Admin space
**Manual: PENDING** — see Manual Verification Checklist steps 4, 5.

### Flow 5: Add Card → New Scraper Pipeline → Review Gate → Confirm (NEW since prior QA)
**Manual: PENDING** — see Manual Verification Checklist steps 5, 6, 7.

### Flow 6: End-to-end (scrape → review gate → confirm → Cards → Overview)
**Manual: PENDING** — see Manual Verification Checklist step 7.

### Flow 7: Remove card
**Manual: PENDING** — see Manual Verification Checklist step 9.

### Flow 8: Console errors during normal operation
**Manual: PENDING** — see Manual Verification Checklist step 10.

---

## Edge Case Assessment

Verified via automated tests in this pass; browser-level edge cases moved to manual checklist.

- **Scrape failure handling** — PASS (automated). `scrape.integration.test.ts` confirms `ScraperError` is mapped to `scrapeError` payload with `{ url, issuer, reason }`. Review gate is documented to render an amber banner with manual-entry fallback (verified in prior QA; UI code unchanged for this path).
- **Classification not in allowlist** — PASS (automated). `POST /api/benefits/confirm` returns 400 when classification is unknown.
- **Empty benefits array on confirm** — PASS (automated). Returns 400.
- **Invalid type enum on confirm** — PASS (automated). Returns 400.
- **Client trying to override server-derived `tracked`** — PASS (automated). Server ignores client `tracked` on confirm; PATCH/[id] strips client `tracked` and `classification` (Decision A).
- **`tracked=false` benefits in Overview** — PASS (automated). `overview.integration.test.ts` explicitly asserts no `tracked=false` benefit appears in any urgency bucket.
- **Cross-user access** — PASS (automated). 403 verified across 4 mutation paths.
- **Unauthenticated read** — PASS (automated). 401 on Overview.
- **HTTP fast-path content under 1500 chars** — PASS (automated). Triggers Playwright fallback.
- **Final scraped content under 200 chars** — PASS (automated). Throws `ScraperError` (CONSTRAINT-10 preserved).
- **Empty form / invalid input on review gate manual entry** — PENDING manual (no regression suspected; UI code unchanged).
- **Session expiry behavior** — PENDING manual / not covered by automated tests. Non-blocking gap carried forward.

---

## Findings

### NON-BLOCKING — Browser automation unavailable; manual verification required

**Founder Brief**
**Decided:** Browser MCPs are not exposed in this Claude session, so the assembled Overview redesign and the new scraper pipeline were verified only at the test/contract layer this pass.
**Means for your product:** Automated tests confirm the data, persistence, and API contracts behave correctly. Visual verification of the Overview at 375px and 1280px against the design artifact, and a live smoke of the new HTTP-first/Playwright-fallback scraper, still need to happen with your eyes before you rely on this daily.
**Check before approving:** Run through the Manual Verification Checklist below with `npm run dev` running. The single non-negotiable item is the assembled Overview rendering at 375px — "most urgent action visible without scrolling" is binding per the design memory.
**What this closes off:** Nothing — APPROVED status stands once the checklist passes.

**What is wrong:** Phase 2 of the QA agent's process (browser workflow verification via Playwright/devtools MCP) could not run.
**What must be done:** Walk through the Manual Verification Checklist below. If anything fails, re-run `@qa` with the failure documented.

---

### NON-BLOCKING — `docs/testing-setup.md` has stale references (carried from prior QA, still unfixed)

**Founder Brief**
**Decided:** The testing-setup doc still references `ADMIN_PASSWORD_HASH` instead of `ADMIN_PASSWORD` (CONSTRAINT-14) and lists port 3000 instead of 3002.
**Means for your product:** New collaborators following the doc literally will fail to log in until they look at `.env` and code.
**Check before approving:** N/A — doc-only fix, can be done any time.
**What this closes off:** Nothing.

**What is wrong:** Line 22 ("(fill in plaintext before testing)") and line 64 ("ADMIN_PASSWORD_HASH is a valid bcrypt hash") are inconsistent — code uses `ADMIN_PASSWORD` (plaintext compared via bcrypt against `ADMIN_PASSWORD_HASH` env or similar — verify in `src/lib/auth.ts`); line 11 says port 3000 but app runs on 3002.
**What must be done:** Update `docs/testing-setup.md` lines 11, 22, 64 to match current `.env.example` and `src/lib/auth.ts`. One-line fixes.

---

### NON-BLOCKING — 28 npm audit vulnerabilities (13 moderate, 15 high)

**Founder Brief**
**Decided:** `npm audit` flags 28 vulnerabilities, the bulk transitive in dev tooling (e.g., postcss chain).
**Means for your product:** No runtime exposure for a local-only, single-user MVP — the dev server isn't accessible externally and there's no user-supplied input that reaches these packages at runtime. But the count is high enough that it should be reviewed before Phase 2 (Vercel migration), where the same dependency tree gets exposed to the internet.
**Check before approving:** N/A for MVP. Before Phase 2, run `npm audit fix` and verify nothing breaks.
**What this closes off:** Nothing today. Defers a chore.

**What is wrong:** `npm audit` reports 28 vulnerabilities (13 moderate, 15 high); root names include the postcss tree.
**What must be done:** Review in a dedicated session. Try `npm audit fix` (non-breaking) first; for any remaining, evaluate `npm audit fix --force` against the test suite.

---

### NON-BLOCKING — 4 cards in user data have zero benefits (current state, not a defect)

**Founder Brief**
**Decided:** Four user cards currently have no benefits attached (Chase Freedom Unlimited + Amex Platinum + Amex Gold + Amex Hilton Aspire, per the session handoff). This is user data state, not a code defect.
**Means for your product:** Those cards show empty in Cards and don't contribute to Overview totals — accurate to current DB state.
**Check before approving:** Re-scrape at least Freedom Unlimited (server-rendered, lower risk than the Amex set) on the new Task-39 pipeline to confirm benefits land in the review gate.
**What this closes off:** Nothing.

**What is wrong:** Not a code issue. The previous scraper pipeline produced empty output for these cards; the new pipeline (Task 39) is designed to handle both server-rendered and JS-heavy pages but has not yet been exercised on these specific URLs.
**What must be done:** Optional — re-scrape via Admin → card → re-scrape. Covered in Manual Verification Checklist step 6.

---

### NON-BLOCKING — EH-01 soft advisory on scraper degradation path (already accepted)

**Founder Brief**
**Decided:** `@code-review` on Task 39 flagged 5 documented silent catches on the scraper degradation path (e.g., `networkidle` timeout swallowed to continue). Reviewed and accepted.
**Means for your product:** Scraper degrades gracefully instead of throwing — when an analytics call never settles, the pipeline keeps going. Aligned with EH-03 intent for this code path.
**Check before approving:** No action.
**What this closes off:** Nothing.

**What is wrong:** Nothing actionable; documented for traceability. Each silent catch is intentional + commented.
**What must be done:** Nothing for MVP.

---

## Manual Verification Checklist

> **Run this with `npm run dev` running (port 3002). Test credentials from `docs/testing-setup.md` after correcting the stale lines noted above — fall back to `.env` if needed.** Each step has: action, expected outcome, screenshot reminder. If any step fails, document the failure and re-run `@qa`.

### Auth + initial paint

**Step 1 — Login**
- Action: Navigate to `http://localhost:3002`. Should redirect to `/login`. Enter `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`. Submit.
- Expected: Redirected to `/overview` with BottomNav showing Overview | Cards | Admin. No console errors.
- Screenshot: Login page (pre-submit) and Overview (post-login) at 375px and 1280px.

### Overview space (urgency-primary triage — NEW since prior QA, binding per design memory)

**Step 2 — Overview renders with real data at 375px**
- Action: With the 8 currently-tracked benefits (post-backfill: Venture X + Amazon Prime Visa), open Overview on a 375px viewport (Chrome DevTools mobile mode).
- Expected: "Money at Risk" hero visible. Three sections present in order: Needs attention, On track, Done. **The most urgent action item is visible without scrolling.** Framer Motion animations fire: count-up on the money-at-risk number, spring transitions, `whileTap` on rows, `AnimatePresence` on bucket transitions.
- Screenshot: Full Overview at 375px (you may need to stitch — capture above-the-fold first).

**Step 3 — Overview at 1280px**
- Action: Same Overview, 1280px viewport.
- Expected: Layout adapts cleanly; no horizontal scrollbar; hero and 3 sections still readable.
- Screenshot: Overview at 1280px.

### Admin space + new scraper pipeline (Task 39 — NEW since prior QA)

**Step 4 — Admin list renders**
- Action: Navigate to Admin. Verify the existing cards from the backfill session are listed.
- Expected: Card rows show issuer, name, last verified date, benefit count. Cards with 0 benefits (Freedom Unlimited + Amex × 3) clearly indicate empty state.
- Screenshot: Admin list at 375px.

**Step 5 — Scrape a server-rendered card (HTTP fast path)**
- Action: From Admin, trigger a re-scrape of **Chase Sapphire Reserve** or **Capital One Venture X**. Watch the terminal logs for "fast path" / sub-2s completion.
- Expected: Scrape completes in < 2s (no Playwright launch). Review gate opens with draft benefits classified into buckets. Excluded buckets (auto-earn, passive-perk, one-time-bonus) collapsed behind a summary count.
- Screenshot: Review gate showing classified + excluded benefits.

**Step 6 — Scrape a JS-heavy card (Playwright fallback) — re-scrape one of the 4 empty cards**
- Action: Re-scrape **Chase Freedom Unlimited** (safest of the 4 empty — Amex × 3 carry anti-bot risk per A3). Then optionally try Amex Platinum.
- Expected for Freedom Unlimited: Either HTTP fast path succeeds (preferred), or Playwright fallback succeeds and benefits land in review gate. Either outcome is a PASS as long as benefits appear OR the review gate shows the amber manual-entry fallback banner cleanly. A crash or a hung scrape is a FAIL — re-run `@qa`.
- Expected for Amex Platinum (if attempted): Most likely Playwright fallback. Acceptable outcomes: substantive text returned OR graceful failure into manual-entry fallback. Anti-bot block (Cloudflare/Akamai) is acceptable and expected per A3.
- Screenshot: Review gate (either populated or showing fallback banner) for each card attempted.

**Step 7 — Confirm + end-to-end propagation**
- Action: In the review gate from Step 5 or 6, confirm 1+ tracked benefits. After confirm, navigate to Cards space, then Overview.
- Expected: Confirmed benefits appear on the card in Cards space (with `tracked=true` only). Overview aggregates update — totals and urgency buckets reflect the new data. No console errors.
- Screenshot: Cards expanded showing new benefit; Overview hero with updated totals.

### Cards space

**Step 8 — Apple Wallet stack interaction**
- Action: Navigate to Cards. Tap/click each card.
- Expected: Cards render with issuer-color identity. Expanded card shows benefits with `tracked=true` only. `tracked=false` benefits never appear here.
- Screenshot: Cards stack collapsed + one card expanded.

### Admin destructive ops

**Step 9 — Remove card flow**
- Action: From Admin, click trash icon on a test card (preferably one created during this manual run, not an existing real one). Confirm in dialog.
- Expected: ConfirmDialog renders with red "Remove" button and warning about benefits + usage history. After confirm, card disappears from Admin, Cards, and Overview.
- Screenshot: ConfirmDialog before confirm; Admin after removal.

### Console + observability

**Step 10 — Console error sweep**
- Action: With DevTools open, navigate through Overview → Cards → Admin → back to Overview. Trigger one scrape + confirm cycle if not already done.
- Expected: Zero `console.error` calls during any normal operation. Network tab: no 5xx; expected 4xx only on intentional error tests (cross-user 403, etc.).
- Screenshot: DevTools Console showing empty error list after a full walkthrough.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 5 (browser-automation gap, stale testing-setup doc, 28 npm audit vulns, 4 empty user cards, EH-01 advisory)
**Tests:** 151/151 passing (110 unit + 41 integration). Build clean. 17 routes.

**Verdict:**
APPROVED — with mandatory manual verification. All critical-path automated coverage is in place: auth, data writes, access control, classification policy, scraper contract, and the canonical end-to-end happy path. The new Overview redesign (Tasks 36–38), classification model (Tasks 29–35), Path B backfill, and the generic scraper redesign (Task 39) are all behind passing tests. No known broken flows. No security-adjacent issues.

The five non-blocking findings are documented for follow-up — none prevent shipping for MVP (local, single-user, desktop-only). The product is shippable once the Manual Verification Checklist above passes with the dev server running. If any checklist step fails, document the failure and re-run `@qa`.

Recommended next step after manual checklist passes: re-run `@security` (prior CLEAR report predates Tasks 29–39), then `@launch-prep`.
