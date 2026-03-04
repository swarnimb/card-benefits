# Plan: Card Benefits Tracker — MVP

## Source
- PRD: docs/prd.md — Features 1-7
- Architecture: docs/architecture.md

---

## Phase A: Foundation + Backend

> No UI skill needed. Pure setup, data, APIs, and engine logic.

| # | Task | Acceptance Criteria | Files | Size |
|---|------|---------------------|-------|------|
| ~~1~~ | ~~Initialize Next.js project with TypeScript, Tailwind, Prisma, SQLite~~ | ~~`npm run dev` starts clean app, Prisma client connects to SQLite, `@/` alias works, directory structure matches architecture~~ | ~~`package.json`, `tsconfig.json`, `tailwind.config.ts`, `src/lib/db.ts`, `.env.example`~~ | ~~M~~ |
| ~~2~~ | ~~Create Prisma schema and run migration~~ | ~~All 6 models (AppState, Card, Benefit, UserCard, Transaction, ImportBatch) created with indexes and relations, migration runs clean~~ | ~~`prisma/schema.prisma`, `prisma/migrations/`~~ | ~~M~~ |
| ~~3~~ | ~~Define TypeScript types~~ | ~~Card, Benefit, UserCard, Transaction, CSV format, and API response types defined~~ | ~~`src/types/card.ts`, `src/types/transaction.ts`, `src/types/csv.ts`~~ | ~~S~~ |
| ~~4~~ | ~~Create seed data for 3 initial cards + seed script~~ | ~~3 cards (Chase Sapphire Preferred, Amex Gold, Capital One Venture X) with complete benefit data in JSON, seed script populates DB, `npx prisma db seed` works~~ | ~~`data/cards/chase-sapphire-preferred.json`, `data/cards/amex-gold.json`, `data/cards/capital-one-venture-x.json`, `prisma/seed.ts`~~ | ~~M~~ |
| ~~5~~ | ~~Build app-state API route~~ | ~~GET returns all app state flags, PATCH updates individual flags, tutorial_seen flag creates/updates correctly~~ | ~~`src/app/api/app-state/route.ts`~~ | ~~S~~ |
| ~~6~~ | ~~Build cards API routes~~ | ~~GET /api/cards returns all cards with benefits, GET /api/cards/user returns user's cards, POST adds cards, PATCH updates point balance, DELETE removes card + cascades transactions~~ | ~~`src/app/api/cards/route.ts`, `src/app/api/cards/user/route.ts`, `src/app/api/cards/user/[id]/route.ts`~~ | ~~M~~ |
| ~~7~~ | ~~Define CSV bank format mappings for 7 banks~~ | ~~Column mapping config per bank (Chase, Amex, Capital One, Citi, BoA, Discover, Wells Fargo), each exports a typed format definition with column names and positions~~ | ~~`src/lib/csv/formats/chase.ts`, `amex.ts`, `capital-one.ts`, `citi.ts`, `boa.ts`, `discover.ts`, `wells-fargo.ts`~~ | ~~M~~ |
| ~~8~~ | ~~Build CSV parser + bank format auto-detection~~ | ~~Papa Parse integration, auto-detect bank from CSV column headers against known formats, normalize parsed rows to common transaction schema, handle credits/debits~~ | ~~`src/lib/csv/parser.ts`, `src/lib/csv/detect.ts`~~ | ~~M~~ |
| ~~9~~ | ~~Build CSV import API routes with duplicate detection~~ | ~~POST /api/transactions/import accepts CSV + userCardId, parses + detects bank + deduplicates, returns preview (count, date range, dupes). POST /api/transactions/confirm stores transactions + creates ImportBatch~~ | ~~`src/app/api/transactions/import/route.ts`, `src/app/api/transactions/confirm/route.ts`~~ | ~~M~~ |
| ~~10~~ | ~~Build transaction query + delete API routes~~ | ~~GET /api/transactions/[userCardId] returns transactions for a card, DELETE clears transactions for a card~~ | ~~`src/app/api/transactions/[userCardId]/route.ts`~~ | ~~S~~ |
| ~~11~~ | ~~Build LLM categorizer~~ | ~~Claude Haiku integration — accepts batch of up to 50 merchant names, returns JSON map of merchant → category, caches known merchants to avoid re-categorization, POST /api/categorize endpoint~~ | ~~`src/lib/categorizer/index.ts`, `src/app/api/categorize/route.ts`~~ | ~~M~~ |
| ~~12~~ | ~~Build matching engine: transaction → benefit matcher~~ | ~~Given a card's benefits and a list of transactions, match each transaction to the highest-priority benefit by category~~ | ~~`src/lib/engine/matcher.ts`~~ | ~~M~~ |
| ~~13~~ | ~~Build matching engine: utilization calculator~~ | ~~Given a trackable benefit, determine current period window (monthly/quarterly/annual using capPeriod + resetMonth), query matching transactions, calculate utilization = sum / capAmount. Handle uncapped benefits (null cap).~~ | ~~`src/lib/engine/utilization.ts`~~ | ~~M~~ |
| ~~14~~ | ~~Build matching engine: points estimator~~ | ~~Given user's pointBalance + pointBalanceUpdatedAt + card's points-earning benefits + transactions after balance date, calculate estimated total points. Highest rate wins per category, base rate fallback.~~ | ~~`src/lib/engine/points.ts`~~ | ~~M~~ |
| ~~15~~ | ~~Build benefits API with utilization~~ | ~~GET /api/benefits/[userCardId] returns all benefits with calculated utilization (from engine) + estimated points total. Wires matcher, utilization, and points engine together.~~ | ~~`src/app/api/benefits/[userCardId]/route.ts`~~ | ~~M~~ |

### Phase A Dependencies
```
1 → 2 → 3 → 4 (foundation chain)
4 → 5, 6 (APIs need seeded DB)
3 → 7 → 8 → 9 → 10 (CSV chain)
9 → 11 (categorizer runs during import confirm)
6 → 12 → 13, 14 (matching engine needs cards API)
12, 13, 14 → 15 (benefits API wires all engines)
```

---

## Phase B: Frontend

> Invoke `@ui consumer` before starting this phase. All components built under consumer mode rules (shadcn/ui base, Magic UI accents, micro-interactions, personality).

| # | Task | Acceptance Criteria | Files | Size |
|---|------|---------------------|-------|------|
| ~~16~~ | ~~Install shadcn/ui + add base components~~ | ~~shadcn/ui initialized, core components added (Button, Dialog, Input, Card, Sheet, Progress, Tabs), Tailwind configured with shadcn theme~~ | ~~`components.json`, `src/components/ui/*`~~ | ~~S~~ |
| ~~17~~ | ~~Build bottom navigation component~~ | ~~3-tab bottom nav (Dashboard, Import, Settings) with icons, active state highlighted, polished aesthetic per consumer mode, hidden during onboarding~~ | ~~`src/components/shared/bottom-nav.tsx`~~ | ~~M~~ |
| ~~18~~ | ~~Build root layout + entry point routing~~ | ~~Root layout includes bottom nav conditionally (hidden during onboarding), page.tsx checks app-state API and redirects to /onboarding or /dashboard~~ | ~~`src/app/layout.tsx`, `src/app/page.tsx`~~ | ~~S~~ |
| ~~19~~ | ~~Build tutorial screens~~ | ~~3-screen walkthrough with illustrations/mock previews, skip button, smooth transitions between screens, navigates to card selection on complete~~ | ~~`src/app/onboarding/page.tsx`, `src/components/onboarding/tutorial-screen.tsx`~~ | ~~M~~ |
| ~~20~~ | ~~Build card selection flow~~ | ~~Search bar with real-time filtering, cards grouped by bank, multi-select with visual feedback, minimum 1 card required (button disabled otherwise), shows card count from DB, saves via POST /api/cards/user~~ | ~~`src/app/onboarding/select/page.tsx`, `src/components/onboarding/card-picker.tsx`~~ | ~~M~~ |
| ~~21~~ | ~~Build points balance entry + onboarding completion~~ | ~~Optional points entry per selected card with skip, saves via PATCH /api/cards/user/[id], marks tutorial_seen in app-state, redirects to dashboard~~ | ~~`src/app/onboarding/points/page.tsx`, `src/components/onboarding/points-entry.tsx`~~ | ~~S~~ |
| ~~22~~ | ~~Build card carousel (swipeable)~~ | ~~Swipeable card container using embla-carousel, smooth transitions, dot indicators showing current card, card-centric layout~~ | ~~`src/components/dashboard/card-carousel.tsx`~~ | ~~M~~ |
| ~~23~~ | ~~Build card view component~~ | ~~Single card display: card name/bank/color header, secondary balance/credit info, slots for benefit list and points display~~ | ~~`src/components/dashboard/card-view.tsx`~~ | ~~M~~ |
| ~~24~~ | ~~Build benefit list + benefit item + utilization bar~~ | ~~Benefits grouped as "Tracked" (with progress bars) and "Available" (display-only with descriptions), each item tappable for modal, utilization bar with satisfying fill animation~~ | ~~`src/components/dashboard/benefit-list.tsx`, `src/components/dashboard/benefit-item.tsx`, `src/components/dashboard/utilization-bar.tsx`~~ | ~~M~~ |
| ~~25~~ | ~~Build points display component~~ | ~~Points balance showing total (baseline + estimated), tap-to-edit for re-sync, visual distinction when no balance entered vs calculated~~ | ~~`src/components/dashboard/points-display.tsx`~~ | ~~S~~ |
| ~~26~~ | ~~Build empty state component~~ | ~~Reusable empty state with personality (consumer mode), variants for: no CSV imported, no points entered, no transactions in period, card just added. Each with contextual CTA.~~ | ~~`src/components/shared/empty-state.tsx`~~ | ~~S~~ |
| ~~27~~ | ~~Assemble dashboard page~~ | ~~Wire all dashboard components (carousel, card view, benefit list, points, empty states), fetch from /api/cards/user + /api/benefits/[id], handle loading/error states~~ | ~~`src/app/dashboard/page.tsx`~~ | ~~M~~ |
| ~~28~~ | ~~Build benefit detail modal~~ | ~~Small modal overlay on benefit tap, shows description + utilization breakdown (matched transactions) + period dates + cap details, conditional external link, close via X or outside click~~ | ~~`src/components/dashboard/benefit-modal.tsx`~~ | ~~M~~ |
| ~~29~~ | ~~Build import page UI~~ | ~~CSV upload dropzone with drag-and-drop, card selector dropdown for target card, import preview showing transaction count + date range + duplicate warning, confirm button, success state~~ | ~~`src/app/import/page.tsx`, `src/components/import/csv-upload.tsx`, `src/components/import/card-selector.tsx`, `src/components/import/import-preview.tsx`~~ | ~~M~~ |
| ~~30~~ | ~~Build settings: card management~~ | ~~List user's cards with bank/name/points, add new cards (reuses card-picker filtered to exclude existing), remove card with confirmation dialog, edit point balance inline~~ | ~~`src/app/settings/page.tsx`, `src/components/shared/confirm-dialog.tsx`~~ | ~~M~~ |
| ~~31~~ | ~~Build settings: data management~~ | ~~Clear transactions per card, clear all transactions, reset point balance, nuclear reset (returns to onboarding). All with confirmation dialogs. Destructive actions styled appropriately.~~ | ~~`src/app/settings/page.tsx`~~ | ~~M~~ |
| ~~32~~ | ~~Seed remaining cards + end-to-end polish~~ | ~~Add 4-7 more card seed files (total 7-10 cards), error handling across all pages, visual consistency check, test full flow: onboarding → dashboard → import CSV → see utilization → settings~~ | ~~`data/cards/*.json`, `prisma/seed.ts`, various components~~ | ~~M~~ |

### Phase B Dependencies
```
16 → 17, 18 (all UI needs shadcn base)
18 → 19 → 20 → 21 (onboarding chain)
18 → 22 → 23 → 24 → 25, 26 → 27 → 28 (dashboard chain)
18 → 29 (import page)
18 → 30 → 31 (settings chain)
All → 32 (polish last)
```

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Card benefit data curation takes longer than expected | Medium | Start with 3 cards (task 4), seed the rest in task 32. Don't block on 10 cards. |
| Swipe library integration issues | Low | Both embla-carousel and swiper are well-documented. Decide during task 22. |
| CSV format edge cases from real bank exports | Medium | Get real CSVs from your own banks early (tasks 7-8). Test with actual files, not mocks. |
| Claude API rate limits or cost during categorization | Low | Batch up to 50 merchants per call, cache results. Haiku is ~$0.01/import. |
| Period windowing logic complexity (quarterly resets) | Medium | Tasks 12-14 are separate specifically for this. Write unit tests for edge cases. |
| Frontend consistency across many components | Medium | Mitigated by building all frontend under `@ui consumer` mode in Phase B. |

## Total Complexity
**Phase A:** 5S + 10M = 15 tasks (backend)
**Phase B:** 4S + 13M = 17 tasks (frontend)
**Total:** 9S + 23M = 32 tasks

## Conflicts
None — fresh project, no existing code.
