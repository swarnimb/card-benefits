# Skill: @scraper

## Purpose
Extracts raw benefit text from major credit card issuer websites using Playwright. Runs locally on the host machine — no cloud constraints, no browser size limits, no timeouts. Produces structured raw data ready for `@llm-parser`. Does not parse or interpret benefit content — extraction only.

---

## Modes

### `@scraper` (reference)
Lists supported issuers and their scraping status. Shows last-scraped timestamp per card if available in the database.

### `@scraper [issuer]`
Scrapes the benefit page for a specific card (e.g., `@scraper amex`, `@scraper chase`). Extracts raw benefit text and returns output for `@llm-parser`.

### `@scraper all`
Scrapes all active cards in the database sequentially. Shows live progress per card. On failure, continues to next card and reports all failures at the end.

---

## Pre-conditions

1. Read `manifest.md` — confirm stack and that Playwright is the scraping tool
2. Read `docs/architecture.md` — understand scraping pipeline design before writing code
3. Playwright must be installed: `npx playwright install chromium`
4. Target card must exist in the database before scraping is triggered

---

## Supported Issuers (Priority Order)

| Issuer | Approach | Notes |
|---|---|---|
| American Express | Navigate to card-specific benefit page | JS-heavy, benefits behind accordion tabs — wait for content |
| Chase | Navigate to card product benefit URL | Requires specific card product page, not generic |
| Capital One | Navigate to product page | Benefits on card landing pages |
| Citi | Navigate to card-specific benefit page | Multiple card-specific URLs |
| Discover | Navigate to card benefit page | Simpler page structure, less JS |
| Other / Unknown | Full page text dump | Extract all visible text, pass to `@llm-parser` with lower confidence expectation |

---

## Process

### Single issuer scrape (`@scraper [issuer]`)

1. Launch Playwright headless Chromium — local, no constraints
2. Navigate to the card's benefit URL (stored per card in DB or derived from issuer)
3. Wait for JS content to load — use `waitForSelector` on key benefit containers, not just `networkidle`
4. Dismiss cookie banners and modal overlays if present
5. Extract benefit sections as structured text blocks: `{ heading: string, content: string }`
6. Take a screenshot of the page and save to `/tmp/scrape-[card_id]-[timestamp].png` for reference
7. Return typed `ScrapeResult` to the caller — do NOT trigger `@llm-parser` directly

### Batch scrape (`@scraper all`)

1. Fetch all `UserCard` records where `isActive = true`
2. For each card: run single issuer scrape
3. Show progress after each card: `"[Card Name] — done"` or `"[Card Name] — FAILED: [reason]"`
4. On completion: print summary — `N succeeded, N failed` + list failed cards with reason
5. Return all `ScrapeResult[]` together

---

## Error Handling

Fail loud. Never silently continue with incomplete data.

| Error | Behavior |
|---|---|
| Page not found / redirect | Return `status: 'failed'`, capture screenshot, log the URL attempted |
| Selector not found (JS not loaded) | Retry once with 10s wait. If still missing: return `status: 'failed'` |
| Bot detection / CAPTCHA | Return `status: 'blocked'` — do not retry. Flag card for manual entry. |
| Timeout >30s | Return `status: 'timeout'` — log card, continue batch |
| Network error | Return `status: 'failed'` with error message |

---

## Output Format

```typescript
type ScrapeResult = {
  card_id: string
  issuer: string
  card_name: string
  scraped_at: string          // ISO timestamp
  status: 'success' | 'failed' | 'blocked' | 'timeout'
  raw_sections: Array<{
    heading: string
    content: string
  }>
  screenshot_path: string | null
  error: string | null
}
```

---

## When To Invoke

- User adds a new card and triggers benefit ingestion for the first time
- User manually triggers re-scrape for a specific card (quarterly refresh)
- User triggers batch re-scrape for all cards

## When Not To Invoke

- For parsing or structuring extracted text — that is `@llm-parser`
- For writing to the database — that is `@data`
- For issuer sites that require login — flag card for manual benefit entry instead
- For cards where benefits were already manually entered and confirmed — re-scrape is a deliberate user action, not automatic

---

## Closing

After scraping: "Scraped [N] card(s). [N succeeded / N failed]. Failed cards: [list with reason]. Pass `ScrapeResult[]` to `@llm-parser` for parsing, then surface to user for the review gate before any DB write."
