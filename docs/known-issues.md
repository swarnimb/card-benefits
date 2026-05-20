# Known Issues: CardMaxxer

> Consolidated list of known bugs, limitations, and accepted risks at launch.
> Updated: 2026-05-19

---

## Non-Blocking Issues

### `docs/testing-setup.md` has stale references
- Line 63 references `ADMIN_PASSWORD_HASH` — should be `ADMIN_PASSWORD` (CONSTRAINT-14)
- Port listed as 3000 — should be 3002
- File is gitignored and informational only. No code impact.

### `docs/session-handoff.md` is stale
- Handoff says Task 25 is next, but all 28 tasks are complete
- Will be corrected at next `@end-session`

---

## Accepted Risks (from `docs/assumptions.md`)

### A2 — Reset anchor may not be stated in scraped text
- Default: `calendar` for all scraped benefits
- Mitigation: user corrects via review gate or Admin edit
- Impact: display accuracy only, not data integrity

### A3 — Playwright may be blocked by some issuers
- Discover and Amex carry bot detection risk
- Mitigation: review gate surfaces scrape failure + manual entry fallback

### A6 — Manual usage entry habit may not form
- App still delivers value as a benefit reference even without usage tracking
- Mitigation: expiring-soon alerts pull user in; weekly cadence is realistic

### A7 — Framer Motion scroll-snap interaction not validated on mobile
- Deferred — mobile validation moves to Phase 2 (Vercel deployment, see assumptions A9)
- Fallback: tap-to-focus if scroll-driven scale is janky

---

## Limitations (by design)

- Re-scraping a card **replaces all benefits and resets usage history** (CONSTRAINT-06)
- No usage history across re-scrapes — "how much did I use last month?" not answerable after re-scrape
- Scraping runs synchronously in the API route — blocks for 15-30s (CONSTRAINT-02)
- Card catalog managed via JSON file edit, not Admin UI (CONSTRAINT-04)
- Single user only — no multi-user support without schema migration (CONSTRAINT-05)
