# Kickoff Brief: CardMaxxer

**Date:** 2026-04-06

## One-Line Description
A personal dashboard that scrapes and tracks credit card benefits across all your cards so you never miss a reset or leave money on the table.

## Problem
Managing 10+ credit cards across Amex, Chase, Capital One, and others means benefits live in separate apps with no unified view. Mental tracking fails — resets go unnoticed, credits expire unused, subscriptions go unclaimed. The cost is real: hundreds of dollars in annual fee value left on the table each year.

## Target User
Swarnim — 10 cards, mix of premium and mid-tier, currently tracking benefits mentally and through individual bank apps. Personal tool first. Open to friends/family/public if it proves genuinely useful.

## Core Scope

### In
- Add and manage cards (manual card setup, select issuer + card name)
- Automatic benefit ingestion via web scraping + Claude Haiku parsing
- Human review gate — confirm/edit parsed benefits before saving
- Benefits grouped by type on dashboard: `$Credits` | `Subscriptions` | `Access` | `Travel` | `One-time Perks`
- Reset timelines per benefit — visible on dashboard
- "Expiring soon" alerts (benefits resetting within 7 days with unused value)
- Manual usage tracking:
  - `$Credits` + `One-time Perks` → slider + manual input (e.g. $47 of $100)
  - `Subscriptions` → toggle (activated / not claimed)
  - `Access` → counter +/- (e.g. 2 of 4 lounge visits used)
- Re-scrape trigger per card with "last verified" timestamp
- Auth (single user MVP, architected for multi-user later)

### Explicitly Out
- Transaction import or auto-matching (MVP)
- Recommendation engine (future — needs transaction history)
- Native mobile app
- Plaid / bank API integration (MVP)
- CSV transaction import (MVP)
- LLM benefit optimization suggestions (future)

## Risks and Assumptions

- **Scraping reliability:** Amex/Chase/CapOne use JS-heavy SPAs; some may require login for full benefit details. Mitigation: review gate catches failures before they corrupt data. Fallback: manual entry.
- **Stale benefit data:** Banks update benefits mid-year without notice. Mitigation: "last verified" timestamp + manual re-scrape trigger. Quarterly re-runs.
- **LLM parsing errors (~15%):** Wrong reset period, wrong value, missed benefit. Mitigation: review screen — no benefit auto-saves without user confirmation.
- **Assumption:** Public benefit pages (no login) contain enough detail to parse the full benefit structure. Needs validation per issuer before build. Flag for `@assumptions`.

## Platform Target
Web responsive — **mobile-primary.** Weekly check-ins ("do I still have dining credit?") happen on phone. Desktop for initial setup and detailed editing.

## Stack

| Component | Decision |
|---|---|
| Framework | Next.js (TypeScript, strict mode) |
| Database | PostgreSQL + Prisma |
| Auth | NextAuth — single user MVP, multi-user ready |
| Scraping | Playwright |
| Benefit Parsing | Claude API (Haiku) |
| Hosting | Vercel (free tier) |
| DB Hosting | Supabase or Railway (free tier) |

Stack is decided. `@cto` to finalize infrastructure choices during `@recruit`.

## Constraints
- **Time:** Ship-when-ready, but ASAP for personal use
- **Budget:** <$2/month total running cost. At 10 cards scraped quarterly, Claude Haiku parsing costs <$0.10/month. Vercel + Supabase free tiers cover the rest. Total: $0 until scale.
- **Technical:** No paid transaction APIs for MVP. All benefit data from public web pages only.
- **Dependencies:** Claude API (Haiku) for parsing — no alternative planned.

## ASCII Wireframe

```
[Add Card] ──────────────────────────────────────────────────────────────────►

+──────────────────+    +──────────────────+    +──────────────────────────+
│   Card Setup     │    │  Benefit Review  │    │       Dashboard          │
│                  │───►│                  │───►│                          │
│ Select issuer    │    │ App scrapes &    │    │ All cards, all benefits  │
│ + card name      │    │ parses benefits  │    │ grouped by type          │
│                  │    │                  │    │                          │
│ [Chase Sapphire] │    │ ✓ $300 Travel    │    │ [$Credits]               │
│ [Amex Platinum]  │    │ ✓ Lounge Access  │    │  Chase: $247/$300 travel │
│ [+ Add Card]     │    │ ✓ Disney+        │    │  Amex: $0/$200 airline   │
│                  │    │                  │    │                          │
│                  │    │ Edit any before  │    │ [Subscriptions]          │
│                  │    │ confirming       │    │  Disney+ ✓ activated     │
│                  │    │                  │    │  Walmart+ ✗ not claimed  │
│                  │    │ [Confirm →]      │    │                          │
+──────────────────+    +──────────────────+    │ [Access]                 │
                                                │  Centurion: 2/unlimited  │
                                                │  Priority Pass: 6/∞      │
                                                │                          │
                                                │ [⚠ Expiring Soon]        │
                                                │  $15 dining resets in 4d │
                                                +──────────────────────────+
                                                           │
                                                           ▼
                                                +──────────────────────────+
                                                │    Benefit Detail        │
                                                │                          │
                                                │ $300 Travel Credit       │
                                                │ Chase Sapphire Reserve   │
                                                │ Resets: Jan 1            │
                                                │                          │
                                                │ ████████░░ $247 / $300   │
                                                │ [──────●────────] slider │
                                                │        or [  247  ]      │
                                                │                          │
                                                │ [Mark Full] [Save]       │
                                                +──────────────────────────+
```

## Open Questions
- Which public benefit pages are scrapeable without login? Needs per-issuer validation before build. (`@assumptions`)
- Does Playwright on Vercel's serverless environment work for scraping, or do we need a separate scraping service? (`@cto`)
- Reset anchor for each card: calendar month vs statement date vs card anniversary — do we ask the user during card setup, or infer from scraped data? (`@cto`)
