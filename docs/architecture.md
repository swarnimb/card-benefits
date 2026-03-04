# Architecture: Card Benefits Tracker

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Dashboard │  │  Import  │  │     Settings     │  │
│  │  (home)   │  │  (csv)   │  │ (cards + data)   │  │
│  └─────┬─────┘  └─────┬────┘  └────────┬─────────┘  │
│        │               │               │             │
│  ┌─────┴───────────────┴───────────────┴──────────┐  │
│  │              Next.js API Routes                 │  │
│  └──────┬──────────────┬───────────────┬──────────┘  │
│         │              │               │             │
│  ┌──────┴─────┐  ┌─────┴─────┐  ┌─────┴──────────┐  │
│  │  Matching  │  │    CSV    │  │  Categorizer   │  │
│  │   Engine   │  │  Parser   │  │  (Claude API)  │  │
│  └──────┬─────┘  └─────┬─────┘  └────────────────┘  │
│         │              │                             │
│  ┌──────┴──────────────┴──────────────────────────┐  │
│  │            Prisma ORM → SQLite                  │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

```
card-benefits/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # → redirects based on app state
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Card benefits dashboard
│   │   ├── import/
│   │   │   └── page.tsx              # CSV upload + preview
│   │   ├── settings/
│   │   │   └── page.tsx              # Card mgmt + data mgmt
│   │   ├── onboarding/
│   │   │   ├── page.tsx              # Tutorial screens
│   │   │   ├── select/
│   │   │   │   └── page.tsx          # Card selection
│   │   │   └── points/
│   │   │       └── page.tsx          # Optional points entry
│   │   └── api/
│   │       ├── cards/
│   │       │   ├── route.ts          # GET all cards in DB
│   │       │   └── user/
│   │       │       ├── route.ts      # GET/POST user's cards
│   │       │       └── [id]/
│   │       │           └── route.ts  # PATCH/DELETE user card
│   │       ├── transactions/
│   │       │   ├── import/
│   │       │   │   └── route.ts      # POST csv upload + parse
│   │       │   ├── confirm/
│   │       │   │   └── route.ts      # POST confirm import
│   │       │   └── [userCardId]/
│   │       │       └── route.ts      # GET/DELETE transactions
│   │       ├── benefits/
│   │       │   └── [userCardId]/
│   │       │       └── route.ts      # GET benefits + utilization
│   │       ├── categorize/
│   │       │   └── route.ts          # POST batch categorize
│   │       └── app-state/
│   │           └── route.ts          # GET/PATCH app state
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── dashboard/
│   │   │   ├── card-carousel.tsx     # Swipeable card container
│   │   │   ├── card-view.tsx         # Single card w/ benefits
│   │   │   ├── benefit-list.tsx      # Tracked + available groups
│   │   │   ├── benefit-item.tsx      # Single benefit row
│   │   │   ├── benefit-modal.tsx     # Detail modal overlay
│   │   │   ├── utilization-bar.tsx   # Progress bar component
│   │   │   └── points-display.tsx    # Points balance display
│   │   ├── import/
│   │   │   ├── csv-upload.tsx        # File upload zone
│   │   │   ├── card-selector.tsx     # Pick card for import
│   │   │   └── import-preview.tsx    # Preview before confirm
│   │   ├── onboarding/
│   │   │   ├── tutorial-screen.tsx   # Single tutorial slide
│   │   │   ├── card-picker.tsx       # Search + multi-select
│   │   │   └── points-entry.tsx      # Optional balance input
│   │   └── shared/
│   │       ├── bottom-nav.tsx        # Bottom navigation bar
│   │       ├── confirm-dialog.tsx    # Destructive action confirm
│   │       └── empty-state.tsx       # Reusable empty state
│   ├── lib/
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── csv/
│   │   │   ├── parser.ts            # Core CSV parse logic
│   │   │   ├── detect.ts            # Bank format auto-detection
│   │   │   └── formats/             # Per-bank column mappings
│   │   │       ├── chase.ts
│   │   │       ├── amex.ts
│   │   │       ├── capital-one.ts
│   │   │       ├── citi.ts
│   │   │       ├── boa.ts
│   │   │       ├── discover.ts
│   │   │       └── wells-fargo.ts
│   │   ├── engine/
│   │   │   ├── matcher.ts           # Match transactions → benefits
│   │   │   ├── utilization.ts       # Calculate usage vs cap
│   │   │   └── points.ts            # Points estimation logic
│   │   └── categorizer/
│   │       └── index.ts             # LLM batch categorization
│   ├── generated/
│   │   └── prisma/                  # Prisma v7 generated client (gitignored)
│   └── types/
│       ├── card.ts                   # Card + benefit types
│       ├── transaction.ts            # Transaction types
│       └── csv.ts                    # CSV format types
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── seed.ts                       # Seed card benefits data
│   └── migrations/                   # Prisma migrations
├── prisma.config.ts                  # Prisma v7 config (datasource URL)
├── data/
│   └── cards/                        # JSON seed files per card
│       ├── chase-sapphire-preferred.json
│       ├── amex-gold.json
│       └── ...
├── docs/
├── .env.example
└── CLAUDE.md
```

## Database Schema

```prisma
model AppState {
  id    String @id @default(cuid())
  key   String @unique
  value String
}

model Card {
  id         String     @id @default(cuid())
  bankName   String
  cardName   String
  cardType   String     // visa, mastercard, amex
  annualFee  Float
  imageColor String     // hex color for card display
  benefits   Benefit[]
  userCards  UserCard[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@unique([bankName, cardName])
}

model Benefit {
  id            String   @id @default(cuid())
  cardId        String
  card          Card     @relation(fields: [cardId], references: [id])
  name          String   // "Dining Cashback", "Travel Credit"
  description   String
  type          String   // cashback, points_multiplier, statement_credit, perk
  trackingType  String   // trackable, display_only
  category      String?  // dining, travel, groceries, gas, streaming, etc.
  rate          Float?   // 0.05 for 5%, 3.0 for 3X points
  rateType      String?  // percentage, multiplier
  capAmount     Float?   // null = uncapped
  capPeriod     String?  // monthly, quarterly, annual
  resetMonth    Int?     // 1=Jan for annual, 1/4/7/10 for quarterly
  externalUrl   String?  // link to merchant/bank page
  createdAt     DateTime @default(now())
}

model UserCard {
  id                    String        @id @default(cuid())
  cardId                String
  card                  Card          @relation(fields: [cardId], references: [id])
  pointBalance          Float?
  pointBalanceUpdatedAt DateTime?
  transactions          Transaction[]
  importBatches         ImportBatch[]
  createdAt             DateTime      @default(now())

  @@unique([cardId])
}

model Transaction {
  id               String      @id @default(cuid())
  userCardId       String
  userCard         UserCard    @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  date             DateTime
  merchant         String
  description      String
  amount           Float
  bankCategory     String?     // from CSV if available
  assignedCategory String      // final category (bank or LLM)
  importBatchId    String
  importBatch      ImportBatch @relation(fields: [importBatchId], references: [id], onDelete: Cascade)
  createdAt        DateTime    @default(now())

  @@index([userCardId, date])
  @@index([userCardId, assignedCategory])
}

model ImportBatch {
  id               String        @id @default(cuid())
  userCardId       String
  userCard         UserCard      @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  fileName         String
  transactionCount Int
  dateRangeStart   DateTime
  dateRangeEnd     DateTime
  transactions     Transaction[]
  importedAt       DateTime      @default(now())
}
```

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cards` | List all cards in master catalog |
| GET | `/api/cards/user` | List user's selected cards |
| POST | `/api/cards/user` | Add card(s) to user's collection |
| PATCH | `/api/cards/user/[id]` | Update point balance |
| DELETE | `/api/cards/user/[id]` | Remove card + cascade delete transactions |
| POST | `/api/transactions/import` | Upload CSV, returns parsed preview |
| POST | `/api/transactions/confirm` | Confirm import, store transactions |
| GET | `/api/transactions/[userCardId]` | Get transactions for a card |
| DELETE | `/api/transactions/[userCardId]` | Clear transactions for a card |
| GET | `/api/benefits/[userCardId]` | Get benefits + calculated utilization |
| POST | `/api/categorize` | Batch categorize merchants via Claude |
| GET | `/api/app-state` | Get app state flags |
| PATCH | `/api/app-state` | Update app state flags |

## Data Flows

### CSV Import Pipeline

```
CSV file
  → Papa Parse (raw parse)
  → Bank format detection (match column headers)
  → Bank-specific mapper (normalize to common schema)
  → Duplicate check (against existing transactions)
  → Preview returned to user
  → On confirm:
      → Uncategorized merchants batched to Claude Haiku
      → Categorized transactions stored in DB
      → ImportBatch record created
```

### Benefit Utilization Calculation

```
Request for card's benefits
  → Load card's trackable benefits
  → For each benefit:
      → Determine current period window (start/end dates from capPeriod + resetMonth)
      → Query transactions in that window matching benefit's category
      → Sum amounts
      → utilization = sum / capAmount (or null if uncapped)
  → Return benefits with utilization data attached
```

### Points Estimation

```
Request for card's points
  → Load user's pointBalance + pointBalanceUpdatedAt
  → Load card's points-earning benefits (type: points_multiplier)
  → Query all transactions after pointBalanceUpdatedAt
  → For each transaction:
      → Find matching benefit by category (highest rate wins)
      → estimatedPoints = amount × rate
      → Fallback: base rate (1X) if no category match
  → totalPoints = pointBalance + sum(estimatedPoints)
```

## LLM Integration

### Transaction Categorization (Claude Haiku)

- Triggered during CSV import for transactions without a bank-provided category
- Batch processing: send up to 50 merchant names per request
- Prompt returns a JSON map: `{ "UBER EATS": "dining", "SHELL OIL": "gas", ... }`
- Category taxonomy is fixed and matches benefit categories: `dining`, `travel`, `groceries`, `gas`, `streaming`, `entertainment`, `drugstore`, `transit`, `general`
- Results cached: if we've seen a merchant before, reuse the assigned category

## Import Strategy

- **Absolute imports** via `@/` path alias (maps to `src/`)
- Why: cleaner than relative paths, standard Next.js convention

## Entry Point

- `src/app/page.tsx` — checks app state, redirects to `/onboarding` (first visit) or `/dashboard` (returning)
- Dev: `npm run dev`
- Build: `npm run build && npm start`

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| App Router vs Pages Router | App Router | Modern Next.js standard, better layouts, server components |
| SQLite vs Postgres | SQLite | Zero setup for local app, Prisma makes migration to Postgres trivial later |
| Prisma SQLite driver | `@prisma/adapter-better-sqlite3` | Prisma v7 requires driver adapters — can't instantiate PrismaClient without one |
| Tailwind config | CSS-based (Tailwind v4) | Tailwind v4 uses `@import "tailwindcss"` in globals.css — no `tailwind.config.ts` needed |
| CSV parsing client vs server | Server (API route) | File handling + LLM calls belong server-side |
| Swipe implementation | Library TBD (embla-carousel or swiper) | Both work well with React, decide during build |
| State management | React Server Components + client fetch | No Redux needed — data is DB-driven, fetched per page |
| Seeded data vs runtime scraping | Seeded JSON files | Reliable for MVP, scraping is a future pipeline |
