# Architecture: CardMaxxer

> Produced by `@plan` — 2026-04-07
> Source: `docs/prd.md`, `docs/design-decisions.md`, `docs/assumptions.md`

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App (local)                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Overview  │  │ Cards (Stack) │  │  Admin                 │ │
│  │ (credits) │  │ (Apple Wallet)│  │  (manage + scrape)     │ │
│  └─────┬─────┘  └──────┬───────┘  └───────────┬────────────┘ │
│        │               │                       │              │
│  ┌─────┴───────────────┴───────────────────────┴──────────┐  │
│  │                  Next.js API Routes                      │  │
│  └──────┬──────────────────┬─────────────────┬────────────┘  │
│         │                  │                 │                │
│  ┌──────┴────┐  ┌──────────┴──┐  ┌──────────┴───────────┐   │
│  │  Period   │  │  Playwright  │  │  Claude Haiku API    │   │
│  │  Engine   │  │  Scraper     │  │  (tool_use only)     │   │
│  └──────┬────┘  └─────────────┘  └──────────────────────┘   │
│         │                                                      │
│  ┌──────┴──────────────────────────────────────────────────┐  │
│  │                Prisma ORM → SQLite                        │  │
│  │                prisma/dev.db (local file)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                    Tailscale MagicDNS
                           │
                    Mobile / other devices
```

---

## Tech Stack

| Layer | Decision | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router, TypeScript strict) | Server components + client components, API routes in one project |
| Database | SQLite via Prisma ORM | Single user, local — no cloud DB overhead |
| Auth | NextAuth v5, Credentials provider, JWT strategy | No DB tables for auth; stateless sessions |
| Scraping | Playwright — native local Chromium | Runs locally, no serverless constraints (validated in A3) |
| LLM | Claude Haiku `claude-haiku-4-5-20251001`, `tool_use` | Structured output, validated in spike A4 |
| UI | shadcn/ui + Framer Motion + Lucide React | Accessible primitives + scroll-driven animations |
| Deployment | `next start -H 0.0.0.0`, Tailscale MagicDNS | Local machine, accessible from phone via Tailscale |

---

## Directory Structure

```
src/
  app/
    (auth)/
      layout.tsx             ← centered layout, no BottomNav
      login/
        page.tsx             ← credentials login form
    (app)/
      layout.tsx             ← auth guard + BottomNav
      overview/page.tsx      ← Overview space
      cards/page.tsx         ← Cards space (Apple Wallet)
      admin/
        page.tsx             ← Admin space
        add-card/page.tsx    ← Add card flow
    api/
      auth/[...nextauth]/route.ts
      catalog/route.ts               ← GET: card catalog from JSON
      user-cards/
        route.ts                     ← GET list, POST add
        [id]/
          route.ts                   ← DELETE, PATCH
          scrape/route.ts            ← POST: scrape + parse → draft
          benefits/route.ts          ← GET: benefits + current periods
      benefits/
        confirm/route.ts             ← POST: bulk save (replace)
        [id]/
          route.ts                   ← PATCH edit, DELETE remove
          usage/route.ts             ← POST: update usedAmount
      overview/route.ts              ← GET: aggregated credits
  components/
    shared/
      bottom-nav.tsx
      confirm-dialog.tsx
      error-state.tsx
    cards/
      card-stack.tsx
      card-item.tsx
      card-expanded.tsx
      benefit-list.tsx
      benefit-item.tsx
      usage-slider.tsx
      usage-toggle.tsx
      usage-counter.tsx
    overview/
      expiring-alerts.tsx
      category-list.tsx
      category-row.tsx
    admin/
      card-management-list.tsx
      benefit-review-gate.tsx
      benefit-edit-row.tsx
      add-card-modal.tsx
  lib/
    db.ts                    ← Prisma client singleton (globalThis pattern)
    auth.ts                  ← NextAuth config + requireAuth() + getUserId()
    scraper/
      index.ts               ← scrapeCard(issuer, url): dispatch
      generic.ts             ← genericScrape(url): Playwright + innerText
      issuers/
        amex.ts              ← amexScrape(url) — issuer-specific if needed
        chase.ts
        capital-one.ts
        citi.ts
        discover.ts
    parser/
      index.ts               ← parseBenefits(rawText): Claude Haiku call
      schema.ts              ← BENEFIT_EXTRACTION_TOOL definition
    engine/
      periods.ts             ← calculatePeriodBoundary() + ensureCurrentPeriod()
      usage.ts               ← updateBenefitUsage()
      expiring.ts            ← isExpiringSoon() + aggregateOverview()
  hooks/
    use-cards-data.ts        ← Cards space: fetch cards + benefits, optimistic usage updates
  types/
    card.ts                  ← Issuer, CatalogCard, UserCardWithCard, UserCardWithBenefits
    benefit.ts               ← BenefitType, BenefitWithPeriod, DraftBenefit
    api.ts                   ← ApiResponse<T>, OverviewData
data/
  card-catalog.json          ← static: id, issuer, name, scrapeUrl, defaultColor
prisma/
  schema.prisma              ← models only — no datasource url (Prisma 7)
  prisma.config.ts           ← datasource url + migration path (Prisma 7 requirement)
  dev.db                     ← SQLite file (gitignored)
```

---

## Data Model

4 application tables. No auth tables — JWT sessions are stateless.

```prisma
model Card {
  id           String     @id @default(cuid())
  issuer       String     // "Chase" | "Amex" | "Capital One" etc.
  name         String     // "Sapphire Preferred"
  scrapeUrl    String?    // null for custom cards
  defaultColor String     // issuer color hex
  userCards    UserCard[]
}

model UserCard {
  id              String     @id @default(cuid())
  userId          String     // from NextAuth JWT sub claim (ADMIN_USER_ID in .env)
  cardId          String
  displayOrder    Int        @default(0)
  lastVerifiedAt  DateTime?
  statementDay    Int?       // 1-31, for statement resetAnchor
  anniversaryDate DateTime?  // for anniversary resetAnchor
  card            Card       @relation(fields: [cardId], references: [id])
  benefits        Benefit[]
  createdAt       DateTime   @default(now())
  @@unique([userId, cardId])
  @@index([userId])
}

model Benefit {
  id          String          @id @default(cuid())
  userCardId  String
  name        String
  description String?
  type        String          // "credit" | "subscription" | "access" | "perk"
  value       Float?          // dollar cap or count cap; null = unlimited
  valueUnit   String          @default("dollars") // "dollars" | "points"
  resetPeriod String          // "monthly" | "quarterly" | "annual" | "once"
  resetAnchor String          @default("calendar")
  category    String          // "dining" | "travel" | "streaming" | "shopping" | "lounge" | "general"
  isTrackable Boolean         @default(true)
  userCard    UserCard        @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  periods     BenefitPeriod[]
  createdAt   DateTime        @default(now())
  @@index([userCardId])
}

model BenefitPeriod {
  id          String   @id @default(cuid())
  benefitId   String
  periodStart DateTime
  periodEnd   DateTime?   // null when resetPeriod="once"
  usedAmount  Float    @default(0)
  status      String   @default("open") // "open" | "closed"
  benefit     Benefit  @relation(fields: [benefitId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  @@index([benefitId, status])
}
```

**Auth:** `userId` on `UserCard` is the string from the JWT `sub` claim, set from `ADMIN_USER_ID` in `.env`. No `User` model in DB — JWT strategy is stateless (no NextAuth DB adapter needed).

---

## Period Engine

`src/lib/engine/periods.ts`

### calculatePeriodBoundary()

Pure function — no DB calls.

```typescript
function calculatePeriodBoundary(
  resetPeriod: string,
  resetAnchor: string,
  now: Date,
  statementDay?: number,
  anniversaryDate?: Date
): { periodStart: Date; periodEnd: Date | null }
```

| resetPeriod | resetAnchor | periodStart | periodEnd |
|---|---|---|---|
| monthly | calendar | 1st of current month 00:00 | Last day of month 23:59:59 |
| quarterly | calendar | 1st of current quarter 00:00 | Last day of quarter 23:59:59 |
| annual | calendar | Jan 1 current year 00:00 | Dec 31 23:59:59 |
| monthly | statement | Last occurrence of statementDay | Next occurrence − 1 day |
| annual | anniversary | Last anniversary date | Next anniversary − 1 day |
| once | any | Benefit's createdAt | null |

### ensureCurrentPeriod()

```typescript
async function ensureCurrentPeriod(benefitId: string): Promise<BenefitPeriod>
```

1. Query latest open `BenefitPeriod` for benefit
2. If exists AND `periodEnd > now` (or null) → return it, no DB write
3. If exists AND expired → UPDATE `status = 'closed'` → INSERT new open period → return new
4. If none → INSERT first period → return it

**Rule:** Closed periods (`status: 'closed'`) are NEVER updated. Only new records inserted.

---

## Usage Engine

`src/lib/engine/usage.ts`

```typescript
async function updateBenefitUsage(benefitId: string, newAmount: number): Promise<BenefitPeriod>
```

1. Call `ensureCurrentPeriod(benefitId)`
2. Clamp `newAmount` to `[0, benefit.value]` (if value not null)
3. UPDATE `BenefitPeriod.usedAmount` where `id = period.id AND status = 'open'`
4. Return updated period

**This is the ONLY function that writes `usedAmount` to the database.**

---

## Scraper Architecture

`src/lib/scraper/`

- `genericScrape(url)`: launches headless Chromium, waits `networkidle`, returns `document.body.innerText`
- `scrapeCard(issuer, url)`: dispatches to issuer-specific scraper or generic fallback
- Each issuer file: exports `scrape(url)` — re-exports generic unless issuer needs special handling
- All scrapers use realistic User-Agent (Chrome on macOS)
- Browser closed in `finally` block — no leaked processes
- 30-second timeout → throws `ScraperError({ url, issuer, reason })`

---

## Claude Haiku Parser

`src/lib/parser/`

- Model: `claude-haiku-4-5-20251001` — never substituted
- Always uses `tool_use` — never freeform JSON parsing
- Tool schema fields: name, description, type (enum), value, valueUnit (enum: dollars|points), resetPeriod (enum), resetAnchor (enum), category (enum), isTrackable, confidence
- Missing `resetAnchor` → defaults to `"calendar"`
- Missing or invalid `valueUnit` → defaults to `"dollars"`
- Invalid `type` values → clamped to `"perk"`
- Returns `DraftBenefit[]` — empty array is valid (not an error)
- Throws `ParserError({ message, rawTextPreview })` on API failures

Cost: ~$0.007/parse at current Haiku pricing.

---

## API Routes Summary

See `docs/api-spec.md` for full request/response contracts.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog` | Card catalog from `data/card-catalog.json` |
| GET | `/api/user-cards` | User's cards list |
| POST | `/api/user-cards` | Add a card |
| PATCH | `/api/user-cards/[id]` | Update displayOrder, statementDay, anniversaryDate |
| DELETE | `/api/user-cards/[id]` | Remove card (cascades) |
| POST | `/api/user-cards/[id]/scrape` | Scrape + parse → return draft (no DB write) |
| GET | `/api/user-cards/[id]/benefits` | Benefits with current period data |
| POST | `/api/benefits/confirm` | Bulk-save confirmed benefits (replaces all) |
| PATCH | `/api/benefits/[id]` | Edit a benefit |
| DELETE | `/api/benefits/[id]` | Remove a benefit |
| POST | `/api/benefits/[id]/usage` | Update usedAmount |
| GET | `/api/overview` | Aggregated credits + expiring soon |

All routes: `requireAuth()` called first — 401 if no session.

---

## Infrastructure + Deployment

```
# Dev
next dev -H 0.0.0.0 -p 3002

# Production (local)
next build && next start -H 0.0.0.0 -p 3002
```

- Tailscale MagicDNS: `http://[machine-name].ts.net:3002`
- SQLite file: `prisma/dev.db` — local, gitignored
- Playwright Chromium: `npx playwright install chromium` on first setup
- No CI/CD, no cloud hosting, no serverless

### Required .env

```
NEXTAUTH_URL=http://[machine-name].ts.net:3002
NEXTAUTH_SECRET=[random string]
ADMIN_EMAIL=[your email]
ADMIN_PASSWORD=[your password — plaintext, see CONSTRAINT-14]
ADMIN_USER_ID=user_swarnim
ANTHROPIC_API_KEY=[your key]
```

---

## Security Architecture

- All API routes call `requireAuth()` — no public endpoints except `/api/auth/*`
- Credentials: direct string comparison of `ADMIN_PASSWORD` env var — plaintext stored in `.env` (local-only, gitignored; bcrypt dropped due to dotenv-expand incompatibility — see CONSTRAINT-14)
- JWT strategy: no DB session table; session revocation via `NEXTAUTH_SECRET` rotation
- `ANTHROPIC_API_KEY` server-side only — never exposed to client
- Playwright scrapes public URLs only — no credentials passed to browser
- Prisma parameterized queries — no raw SQL string concatenation
- Input validation: all enum fields validated against allowlists in every PATCH/POST handler
- `userId` always sourced from session (`getUserId()`), never from request body

---

## Binding Constraints

See `docs/constraints.md` for full list. Key constraints:

1. SQLite — no PostgreSQL, no cloud DB
2. Playwright synchronous in API route — no job queue
3. Lazy period calculation — no cron job
4. Card catalog is static JSON — not a DB table
5. JWT sessions — no auth DB tables
6. Re-scrape replaces all benefits — no merge
7. `updateBenefitUsage()` is the only write path for `usedAmount`
8. `BenefitPeriod` records are append-only — closed records never mutated
9. Claude Haiku only — model never substituted
10. No benefit auto-saved without user confirmation in review gate
