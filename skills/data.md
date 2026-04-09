# Skill: @data

## Purpose
Owns all Prisma schema design, migration patterns, benefit period generation, reset boundary logic, and usage update patterns for CardMaxxer. Ensures the data model is correct, `benefit_periods` is append-only, and period boundaries are calculated correctly per reset anchor. Does not make product decisions — only how to model and query data correctly.

---

## Modes

### `@data` (reference)
Shows the current schema summary and any active period anomalies.

### `@data schema`
Reviews or proposes changes to `prisma/schema.prisma`. Presents for approval before writing. Generates migration after approval.

### `@data [operation]`
Implements a specific data operation: period generation, usage update, reset check, or query pattern.

---

## Pre-conditions

1. Read `docs/architecture.md` — understand data model decisions before proposing changes
2. Read current `prisma/schema.prisma` — never propose changes without reading existing state
3. Confirm SQLite constraints apply (see below) before any schema work
4. Never touch `BenefitPeriod` records with `status: 'closed'` — append-only, no exceptions

---

## SQLite Constraints

CardMaxxer uses SQLite via Prisma. Apply these constraints to all schema work:

| Constraint | Rule |
|---|---|
| No native enums | Use `String` fields — validate allowed values at application level |
| No array types | Use `String` with JSON serialization (e.g., `validMerchants String @default("[]")`) |
| No `@db.Text` needed | SQLite has no field length limits |
| Concurrent writes | SQLite has single-writer lock — do not design for concurrent writes |
| Boolean | Supported natively as 0/1 — `Boolean` type works fine |

---

## Canonical Schema

```prisma
// prisma/schema.prisma
// NOTE: No datasource url here — Prisma 7 requires it in prisma.config.ts (CONSTRAINT-11)
// NOTE: No User model — JWT strategy, stateless sessions (CONSTRAINT-05)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

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
  resetPeriod String          // "monthly" | "quarterly" | "annual" | "once"
  resetAnchor String          @default("calendar")
  category    String          // "dining" | "travel" | "streaming" | "shopping" | "lounge" | "general"
  isTrackable Boolean         @default(true)
  userCard    UserCard        @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  periods     BenefitPeriod[]
  createdAt   DateTime        @default(now())

  @@index([userCardId])
}

// Append-only. Records with status = 'closed' are NEVER mutated.
model BenefitPeriod {
  id          String    @id @default(cuid())
  benefitId   String
  periodStart DateTime
  periodEnd   DateTime? // null when resetPeriod="once"
  usedAmount  Float     @default(0)
  status      String    @default("open") // "open" | "closed"
  benefit     Benefit   @relation(fields: [benefitId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@index([benefitId, status])
}
```

---

## Period Generation Logic

### Rule: one open period per benefit at any time

Never generate future periods speculatively. Periods are created lazily — on demand when the benefit is read via `ensureCurrentPeriod()`.

### Period boundary calculation

```typescript
function calculatePeriodBoundary(
  resetPeriod: string,   // "monthly" | "quarterly" | "annual" | "once"
  resetAnchor: string,   // "calendar" | "statement" | "anniversary"
  now: Date,
  statementDay?: number,    // from UserCard.statementDay (1-31)
  anniversaryDate?: Date    // from UserCard.anniversaryDate
): { periodStart: Date; periodEnd: Date | null }
```

| resetPeriod | resetAnchor | periodStart | periodEnd |
|---|---|---|---|
| monthly | calendar | 1st of current month 00:00 | Last day of month 23:59:59 |
| quarterly | calendar | 1st of current quarter 00:00 | Last day of quarter 23:59:59 |
| annual | calendar | Jan 1 current year 00:00 | Dec 31 23:59:59 |
| monthly | statement | Last occurrence of statementDay | Next occurrence − 1 day 23:59:59 |
| annual | anniversary | Last anniversary date 00:00 | Next anniversary − 1 day 23:59:59 |
| once | any | Benefit's `createdAt` | null |

### `ensureCurrentPeriod` logic

```typescript
async function ensureCurrentPeriod(benefitId: string): Promise<BenefitPeriod>
```

1. Query latest open `BenefitPeriod` for benefit (status = 'open')
2. If exists AND `periodEnd > now` (or `periodEnd` is null) → return it, no DB write
3. If exists AND expired → UPDATE `status = 'closed'` → INSERT new open period → return new
4. If none → INSERT first period → return it

**Append-only rule:** Records with `status = 'closed'` are NEVER updated. Only the `'open' → 'closed'` transition is allowed (once per record).

### Period close + new period creation

When `periodEnd < now` for an open period:
1. `UPDATE BenefitPeriod SET status = 'closed' WHERE id = period.id` — never touch `usedAmount`
2. `INSERT` new `BenefitPeriod` with new boundaries, `usedAmount = 0`, `status = 'open'`
3. Return new period

---

## Usage Update Rules

All `usedAmount` updates go through a single `updateBenefitUsage()` function. No direct DB writes to `usedAmount` anywhere else (CONSTRAINT-07).

```typescript
async function updateBenefitUsage(
  benefitId: string,
  newAmount: number
): Promise<BenefitPeriod>
```

Steps:
1. Call `ensureCurrentPeriod(benefitId)` to get the active period
2. Clamp `newAmount` to `[0, benefit.value]` (if `benefit.value` is not null)
3. `UPDATE BenefitPeriod SET usedAmount = newAmount WHERE id = period.id AND status = 'open'`
4. Return updated period

Constraints enforced:
- `newAmount` must be ≥ 0
- `newAmount` must be ≤ `benefit.value` (if not null)
- Only writes to periods with `status = 'open'` — the `AND status = 'open'` WHERE clause enforces this
- Return updated period — caller handles UI update

---

## Key Queries

### Get benefits with current open period (cards page / overview)
```typescript
// For a userCardId, get benefits with their open BenefitPeriod
prisma.benefit.findMany({
  where: { userCardId },
  include: {
    periods: {
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 1
    }
  }
})
```

### Get expiring benefits (within N days)
```typescript
// Benefits whose open period ends within N days and has unused value
// periodEnd < now + N days AND usedAmount < benefit.value
// Note: periodEnd can be null for 'once' benefits — exclude those
```

### Get overview aggregates (by category, across all cards)
```typescript
// Filter: type === 'credit' || type === 'perk'
// Group by benefit.category
// Per group: totalAvailable = sum(benefit.value), totalUsed = sum(currentPeriod.usedAmount)
// Exclude categories where totalAvailable === 0
// Return: OverviewData (see src/types/api.ts)
```

---

## When To Invoke

- Any schema design or migration work
- Implementing period generation logic (benefit create handler)
- Implementing usage update handler (slider/toggle/counter change)
- Period close + reset logic (dashboard load check)
- Any query involving `BenefitPeriod` or usage aggregation

## When Not To Invoke

- For scraping benefit text — that is `@scraper`
- For parsing LLM output — that is `@llm-parser`
- For simple queries with no period logic — `@dev` can handle those

---

## Closing

After schema work: "Schema updated. Migration generated. Constraint reminder: `BenefitPeriod` is append-only — never mutate closed periods."
After period logic: "Period generation implemented. Reset anchor: [anchor]. Fallback: [calendar if anchor data missing]. Next: wire to benefit create handler."
After usage logic: "Usage update implemented via `updateBenefitUsage()`. Enforces: ≥0, ≤benefit.value (if set), open-period-only. Next: wire to slider/toggle/counter change handler."
