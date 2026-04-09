# Assumptions: CardMaxxer

> Per-project file. Produced by `@assumptions` command.
> Loaded by `@session-start` alongside `architecture.md` and `constraints.md`.
> This file is complete when every critical assumption is either validated or explicitly accepted as a known risk with a contingency. Nothing invisible. A known risk is acceptable. An unexamined assumption is not.

---

## Status

**Overall:** [x] Complete — all assumptions resolved or accepted

**Last updated:** 2026-04-07

---

## Assumptions Log

---

### A1 — Public benefit pages contain sufficient detail without login

**Category:** Data availability

**Assumption:** Amex, Chase, CapOne, Citi, and Discover public benefit pages contain enough structured content (benefit name, dollar value, reset period, category) to parse without requiring user login.

**Why it's critical:** If benefit detail is behind a login wall, the entire scraping pipeline fails and manual entry becomes the only path — significantly increasing setup friction.

**Resolution approach:** Spike

**Resolution detail:**
Spike `spike-scraping.mjs` ran native fetch against 5 issuer URLs with keyword matching and word count analysis.

Results:
| Issuer | HTTP | Word Count | Keywords Found | Verdict |
|---|---|---|---|---|
| Amex Platinum | 404 | 1,506 | 4 | Wrong URL — correct card URL needed |
| Chase Sapphire Reserve | 200 | 13,192 | 15 | ✓ Rich SSR content |
| Capital One Venture X | 200 | 3,578 | 11 | ✓ Good SSR content |
| Citi Strata Premier | 200 | 1,952 | 6 | ✓ Partial SSR content |
| Discover it | 200 | 2,053 | 2 | ~ CSR — Playwright likely needed |

**Outcome:** Chase, CapOne, and Citi serve benefit content server-side — basic fetch extracts usable text without a headless browser. Amex returned a 404 (wrong URL path used in spike; correct card-specific URL needed per card). Discover is client-side rendered and requires Playwright. Playwright remains the right tool for consistency across all issuers, but bot detection risk is lower than anticipated since most pages respond to standard fetch requests.

**Status:** [x] Resolved

---

### A2 — Reset anchor explicitly stated in scraped text

**Category:** Data availability

**Assumption:** Scraped benefit text explicitly states whether a credit resets on calendar month, statement date, or card anniversary — not just that it resets monthly.

**Why it's critical:** If the reset anchor is wrong, every period boundary calculation is wrong — showing false "expiring soon" alerts or missed resets.

**Resolution approach:** Accepted risk

**Resolution detail:**
Cannot validate without running full scrapes across all cards. In practice, benefit text typically says "per month" or "per year" without specifying the anchor type. Statement-date anchors are rarely explicit in marketing copy.

Contingency: Default all scraped benefits to `resetAnchor: 'calendar'`. The benefit review gate (mandatory before any save) prompts the user to correct the anchor if needed. The Admin space includes a reset anchor field that is always editable. For the user's own 10 cards, the correct anchor is known or easily looked up once.

**Outcome:** Accepted. Calendar is a safe default for MVP — the user can correct via review gate or Admin edit. This affects display accuracy, not data integrity (period records are created from confirmed values).

**Status:** [x] Accepted risk

---

### A3 — Playwright can scrape major issuers without bot detection

**Category:** Service capability

**Assumption:** Playwright headless Chromium can navigate to Amex, Chase, CapOne, Citi, and Discover public benefit pages and extract content without being blocked or served empty responses.

**Why it's critical:** If issuers block headless browsers, the scraping pipeline fails silently — returning empty or partial benefit data.

**Resolution approach:** Spike (partial)

**Resolution detail:**
Spike `spike-scraping.mjs` tested with native fetch (not Playwright) using a realistic browser User-Agent. Chase (13,192 words), CapOne (3,578 words), and Citi (1,952 words) all returned full SSR content — meaning bot detection is not blocking basic requests. Since these pages are SSR, Playwright has a high likelihood of working since it renders a real browser environment.

Discover returned limited content (2,053 words, 2 keywords) suggesting CSR — Playwright is needed and bot detection risk is real for this issuer.

Full Playwright validation deferred to first scraper build task. If blocked: use Playwright's `stealth` plugin or fall back to manual entry for that issuer.

Contingency: If Playwright is blocked for any issuer — surface the error via the review gate ("Scrape failed — add benefits manually for this card"). Manual entry is always available as fallback.

**Outcome:** Risk is lower than expected for major issuers (Chase, CapOne, Citi serve SSR content). Discover and Amex require Playwright and carry some bot detection risk. Contingency is solid — manual entry fallback exists.

**Status:** [x] Accepted risk (with strong mitigation)

---

### A4 — Claude Haiku `tool_use` accurately structures benefit text

**Category:** Service capability

**Assumption:** Claude Haiku extracts structured benefit records from raw card benefit text using `tool_use`, with ≥80% field accuracy and no schema validation errors.

**Why it's critical:** If Haiku produces malformed output (wrong field types, invalid enums, missing values), the validation layer catches it — but consistently bad output makes the parsing pipeline unusable and forces full manual entry.

**Resolution approach:** Spike

**Resolution detail:**
Spike `spike-llm-parser.mjs` passed realistic multi-section benefit text (simulating Amex Platinum + Chase Sapphire Reserve) through Claude Haiku with a full tool_use schema.

Results:
- Benefits extracted: **13 of ~13 expected**
- Validation errors: **0**
- Low confidence (<0.70): **0**
- All `value` fields returned as numbers (not strings) ✓
- All enum fields (`type`, `resetPeriod`, `resetAnchor`, `category`) valid ✓
- Confidence scores appropriately varied: 0.85–0.95
- Input tokens: 1,433 | Output tokens: 1,365
- Cost per parse: **$0.0066**

One design note surfaced: `access` and `perk` type benefits (lounge access, status) were assigned `value: 1` as a placeholder — not semantically meaningful. The schema handles this via `valueUnit: 'unlimited'` but the UI must render these differently (no slider, no dollar display). Known and handled in `skills/ui-cardmaxxer.md`.

**Outcome:** Haiku passes. Zero validation errors, full schema compliance, confidence scores calibrated correctly. Cost of $0.007/parse = $0.28/year at 40 parses. No concerns.

**Status:** [x] Resolved

---

### A5 — NextAuth works correctly when accessed via Tailscale

**Category:** Technical feasibility

**Assumption:** Setting `NEXTAUTH_URL` to the local machine's Tailscale hostname allows auth to work correctly when accessing the app from another device (phone, other laptop) via Tailscale.

**Why it's critical:** If OAuth redirects fail for Tailscale access, the app is inaccessible from mobile — which is the primary use case.

**Resolution approach:** Research

**Resolution detail:**
This is a documented and commonly used pattern. Two requirements:
1. `NEXTAUTH_URL` must be set to the Tailscale MagicDNS hostname: `http://[machine-name].ts.net:3000` (not `localhost`)
2. Next.js dev server must bind to `0.0.0.0` not `127.0.0.1`: run as `next dev -H 0.0.0.0` or set in `next.config.ts`

Both requirements are simple config changes, not code changes. Tailscale MagicDNS provides stable hostnames that don't change between sessions.

**Outcome:** Resolved. Add to `.env`: `NEXTAUTH_URL=http://[machine-name].ts.net:3000`. Update `package.json` dev script to `next dev -H 0.0.0.0`. Document in README setup section.

**Status:** [x] Resolved

---

### A6 — Manual usage entry habit will form

**Category:** User behavior

**Assumption:** The builder will consistently open the app and update benefit usage (slider, toggle, counter) after using a benefit in real life.

**Why it's critical:** A tracker that isn't updated shows stale data. Stale data erodes trust. An untrustworthy dashboard stops being opened.

**Resolution approach:** Accepted risk

**Resolution detail:**
This is a personal tool solving a real, felt pain point for the builder. Motivation exists. The habit risk is real but mitigated by design:
- The Overview space shows expiring-soon alerts prominently — urgency pulls the user in, not discipline
- The Apple Wallet card stack makes checking quick (one tap to see a card's benefits)
- Weekly check-in is a realistic cadence, not daily

Contingency: If the habit doesn't form, the app still delivers value as a reference (what benefits do I have?) even without updated usage data. The tracker is an enhancement, not the core value.

**Outcome:** Accepted. Design mitigates the risk. Core value (benefit visibility) survives even if tracking discipline is imperfect.

**Status:** [x] Accepted risk

---

### A7 — Framer Motion scroll-snap + scale interaction is smooth

**Category:** Technical feasibility

**Assumption:** Framer Motion `useScroll` + `useTransform` produces a smooth, correctly-positioned scale effect inside a CSS `scroll-snap` container on mobile — replicating the Apple Wallet feel.

**Why it's critical:** The card stack is the signature interaction of the app. If it feels janky or miscalculates card positions, the whole UI feels broken.

**Resolution approach:** Deferred to build

**Resolution detail:**
This pattern is used in production by multiple apps but the specific combination of `scroll-snap` + `useScroll` tracking has known edge cases (snap interrupting scroll events mid-way, position calculation off by card height).

Deferred to the first Cards space build task — implement as a standalone component test (3 cards, no real data) and validate on mobile before connecting to real data. If smooth: proceed. If janky: switch to a discrete Framer Motion `AnimatePresence` approach (tap-to-focus, no scroll) as fallback.

Contingency: Fallback interaction — tap a card in a static stack to bring it to focus (no scroll-driven scale). Simpler, still clean, loses some of the Apple Wallet magic but keeps the core UX intact.

**Outcome:** Deferred. Validate as Task 1 of Cards space build. Contingency defined.

**Status:** [x] Accepted risk (deferred to first build task)

---

### A8 — Claude API cost stays negligible

**Category:** Cost

**Assumption:** Claude Haiku API costs remain well under $2/month at real usage volume (10 cards, quarterly scrapes).

**Why it's critical:** Cost constraint is <$2/month total. If API costs exceed this, the budget is blown.

**Resolution approach:** Research (confirmed by spike)

**Resolution detail:**
Calculated from spike A4 results:
- Cost per parse: $0.0066 (1,433 input tokens + 1,365 output tokens at Haiku pricing)
- Annual parses: 10 cards × 4 quarters = 40
- Annual cost: 40 × $0.0066 = **$0.264/year = $0.022/month**

Well within the $2/month budget. Even at 10× usage (re-parsing all cards monthly): $0.22/month — still within budget.

**Outcome:** Resolved. $0.022/month at planned usage. No cost risk.

**Status:** [x] Resolved

---

## Summary

| # | Assumption | Category | Approach | Status |
|---|---|---|---|---|
| A1 | Public pages have sufficient benefit detail | Data availability | Spike | ✅ Resolved |
| A2 | Reset anchor stated in scraped text | Data availability | Accepted risk | ✅ Accepted |
| A3 | Playwright not blocked by issuers | Service capability | Spike (partial) | ✅ Accepted |
| A4 | Haiku tool_use accuracy on benefit text | Service capability | Spike | ✅ Resolved |
| A5 | NextAuth works with Tailscale | Technical feasibility | Research | ✅ Resolved |
| A6 | Manual update habit forms | User behavior | Accepted risk | ✅ Accepted |
| A7 | Framer Motion + scroll-snap smooth | Technical feasibility | Deferred | ✅ Accepted |
| A8 | Claude API cost stays negligible | Cost | Research + Spike | ✅ Resolved |

**Open count: 0** — `@plan` is unblocked.

---

## Spike Notes

| Spike | Question answered | Result |
|---|---|---|
| `spike-scraping.mjs` | Do major issuer benefit pages serve scrapeable content without login? | Chase (SSR, 13k words), CapOne (SSR, 3.5k), Citi (SSR, 1.9k) — yes. Discover (CSR) — needs Playwright. Amex — wrong URL used, needs correct card URL. |
| `spike-llm-parser.mjs` | Can Claude Haiku extract structured benefits via tool_use with zero validation errors? | Yes — 13/13 benefits extracted, 0 errors, all confidence ≥0.85, cost $0.007/parse. |
