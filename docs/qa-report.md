# QA Report

**Date:** 2026-06-19
**Feature:** 12 — Shareable Static Demo (Phase L, Tasks 87–94) + the read-only-modal change (commits `d229199`, `1753720`)
**Status:** APPROVED

> Supersedes the 2026-06-17 Feature 11 QA report (retained in git history). Closes the Feature 12 milestone gate trio: `@code-review` PASS → `@security` CLEAR (2026-06-18) → `@qa` APPROVED. Verified against the **live deployed demo** at https://swarnimb.github.io/card-benefits/ (the shippable artifact).

---

## Coverage Assessment

### Critical Paths (demo-specific — CONSTRAINT-28 read-only)
- [x] Read-only enforcement (writes blocked / session-only no-ops / no persistence): **PASS** — 15 `demo-api` unit tests cover block-403 + emit, interactive no-ops, scrape no-op, debounce, unsubscribe.
- [x] 3-space fixture load (Overview / Cards / Admin): **PASS** — all fixtures asserted (overview, user-cards, per-card benefits, catalog, portfolio-stats), loud throw on missing fixture (no silent empty UI).
- [x] Demo redirect / auth bypass / gating: **PASS** — `DemoRedirect` + login→/overview bypass tested.
- [x] Read-only modal + banner (new change): **PASS** — 6 component tests (render, Got it/Esc/backdrop dismiss, GitHub link, banner-opens-modal-on-blocked-write).
- N/A — Auth login, payments, persisted data writes: none exist in the demo by design (CONSTRAINT-28).

**Test run:** 35/35 demo tests green; full suite 329/329 green (51 files). `npm run build` clean.

### Coverage Gaps
None material. Soft note: `DemoBanner`'s mount in `(app)/layout.tsx` is covered at component level, not in a full layout integration render — acceptable (the contract is exercised).

---

## Browser Workflow Verification (live deployed site, 375px)

### Overview space
**Result:** PASS — renders "$211 money at risk", expiring-soon list, banner + GitHub link. No error boundary. (`live-overview`)

### Cards space
**Result:** PASS — Apple Wallet stack, 5 cards, stats ($2,060 fees / $447 redeemed / $541 available). (`live-cards`)

### Admin space + write flows
**Result:** PASS
- **Delete card → friendly modal:** clicking Remove → confirm → centered "Read-only demo" modal with GitHub link; **no** "Failed to remove" error. (`live-delete-modal`)
- **Re-scrape → scan-then-modal:** timed DOM poll showed `scanning:true` ~0.4–2.1s, then `modal:true` at ~2.45s; **"Failed to scrape" never appeared**.
- **Read-only invariant:** after delete + re-scrape attempts, all 5 cards still present (nothing persisted).
- **Dismiss:** Got it / Esc / backdrop all close the modal.

### Banner / GitHub link
**Result:** PASS — live banner reads "Demo: fictional data, read-only · View on GitHub" (em-dash removed), link → `github.com/swarnimb/card-benefits`, `target=_blank` + `rel=noopener noreferrer`.

---

## Edge Case Assessment

- Write attempts (delete/add/re-scrape) are the demo's primary "failure" paths — all handled gracefully via the friendly modal instead of error screens. Verified live.
- No console errors or error boundaries observed across all three spaces and all flows.
- Deploy pipeline verified: live site reflects the latest commit (`1753720`), confirming the GitHub Pages deploy succeeded.

---

## Findings

### NON-BLOCKING — "-9 days ago" fixture date artifact
**Founder Brief**
**Decided:** Admin rows show "Benefits last checked · -9 days ago" — a negative relative date from the fixture generator.
**Means for your product:** Minor cosmetic oddity a sharp-eyed visitor might notice; nothing breaks.
**Check before approving:** Confirm you're OK shipping this cosmetic artifact (already a parked follow-up).
**What this closes off:** Nothing.
**What is wrong:** Fixture `lastCheckedAt` dates can land slightly in the future relative to render, yielding a negative "days ago".
**What must be done:** Clamp the fixture date (or the relative-time formatter) to ≥0. Parked, non-blocking.

### NON-BLOCKING — `testing-setup.md` has no demo section
**What is wrong:** The QA setup doc targets the local app (localhost, creds) only; the public demo needs no tester setup.
**What must be done:** Optionally add a one-line "demo = live URL, no creds, read-only" note. Documentation-only.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 2 (both cosmetic/doc-only, parked)

**Verdict:** APPROVED — Feature 12 (the public demo) and the read-only-modal change are shippable and verified live. No blocking issues. The Feature 12 milestone gate trio is closed: code-review PASS, security CLEAR, QA APPROVED.
