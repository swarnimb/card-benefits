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

Accessed locally at http://localhost:3002 (desktop only for MVP — Vercel is Phase 2)
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
| Deployment | `next start` (local, desktop-only) | MVP — Vercel migration is Phase 2 (see assumptions A9) |

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
      overview/route.ts              ← GET: urgency triage (money-at-risk + 3 buckets)
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
      tokens.ts                ← Overview-redesign palette + motion presets
      money-at-risk-hero.tsx   ← headline at-risk total, Framer Motion count-up
      urgency-section.tsx      ← Needs attention / On track / Done (collapsed)
      overview-benefit-row.tsx ← one benefit row; type/category = metadata only
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
      schema.ts              ← BENEFIT_EXTRACTION_TOOL definition (includes required `classification` field)
      classification.ts      ← deterministic bucket→tracked policy map; never LLM-set
    engine/
      periods.ts             ← calculatePeriodBoundary() + ensureCurrentPeriod()
      usage.ts               ← updateBenefitUsage()
      expiring.ts            ← isExpiringSoon() + buildOverviewTriage()
  hooks/
    use-cards-data.ts        ← Cards space: fetch cards + benefits, optimistic usage updates
  types/
    card.ts                  ← Issuer, CatalogCard, UserCardWithCard, UserCardWithBenefits
    benefit.ts               ← BenefitType, BenefitWithPeriod, DraftBenefit
    api.ts                   ← ApiResponse<T>, OverviewData (urgency triage), OverviewBenefit
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
  classification String       @default("one-time-bonus") // app-validated bucket: "discretionary-credit" | "activation-perk" | "auto-earn" | "passive-perk" | "one-time-bonus" — NOT a Prisma enum (CONSTRAINT-01)
  tracked     Boolean         @default(false) // derived deterministically from classification by src/lib/parser/classification.ts — never set by the LLM
  setAndForget Boolean        @default(false) // Feature 8: derived deterministically (like `tracked`) by classification.ts — true = one setup action, value auto-recurs. Never set by the LLM
  activatedAt DateTime?       // Feature 8: set-and-forget activation — null = not set up, timestamp = active. Written only via setBenefitActivation() (CONSTRAINT-16)
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

### Benefit Classification & Tracking (Feature 3.5)

Two fields on `Benefit` implement the Missability model (see `docs/prd.md` Feature 3.5):

- **`classification`** (`String`) — exactly one of 5 buckets: `discretionary-credit`, `activation-perk`, `auto-earn`, `passive-perk`, `one-time-bonus`. This is an app-level validated string, NOT a Prisma `enum` (CONSTRAINT-01: SQLite has no native enums; validate against the allowlist in every POST/PATCH handler, same pattern as `type`/`resetPeriod`/`category`). The LLM (Haiku, `tool_use`) assigns this bucket as a structured field — it represents judgment about the benefit.
- **`tracked`** (`Boolean`, default `false`) — whether the benefit appears in tracked views (Overview, expiring-soon). This represents policy, not judgment. It is **derived deterministically** from `classification` by `src/lib/parser/classification.ts` and is **never set by the LLM**. Separating judgment (classification) from policy (tracked) means the tracked policy can change without re-prompting Haiku.

Excluded benefits are persisted with `tracked = false` — never dropped — so a future "view all / manually override" capability does not require a re-scrape.

**Field-name note:** There is exactly ONE tracking field: `tracked` (Boolean, server-derived from `classification` via the policy module). `tracked` (driven by `classification`) is the field Overview and expiring-soon logic must read. The retired `tracked` field name standardization is recorded in `docs/session-log.md` [2026-05-15] — do not reintroduce a separate field.

#### Classification → tracked policy module

`src/lib/parser/classification.ts` — new deterministic module. Owns the single source of truth for the bucket→`tracked` policy map:

| `classification` bucket | `tracked` |
|---|---|
| `discretionary-credit` | `true` |
| `activation-perk` | `true` |
| `auto-earn` | `false` |
| `passive-perk` | `false` |
| `one-time-bonus` | `false` |

- Pure function, no DB calls, no LLM calls. Input: `classification` string. Output: `tracked` boolean.
- Also validates the classification string against the 5-bucket allowlist; an unrecognized/ambiguous value defaults to the conservative trackable bucket `discretionary-credit` (`tracked = true`) — never silently hidden (see assumptions A10, PRD Feature 3.5 edge cases).
- Called by the confirm path (`POST /api/benefits/confirm`) and any code persisting a benefit, so `tracked` is always set in code, never trusted from the client or the LLM.
- Module placement under `src/lib/parser/` is intentional: classification is parser-domain output policy, sitting alongside `index.ts` (Haiku call) and `schema.ts` (tool definition).

#### Migration (additive, no backfill)

Migration: additive at the SQLite column level (add `classification`, `tracked`; drop `isTrackable`) with NO data backfill — but note this is a **coordinated rename** of `isTrackable` → `classification`+`tracked` that must be applied in one sweep across schema, `src/types/benefit.ts`, the parser (`schema.ts`/`index.ts`), the confirm and `[id]` routes, and `src/lib/engine/expiring.ts` (see plan Tasks 29–34). 'Additive' refers only to the DB column operation, not the code surface. Safe defaults: `tracked` defaults to `false`, `classification` defaults to `"one-time-bonus"` (a safe non-trackable bucket — no benefit is wrongly surfaced by the default). Per CONSTRAINT-11, the datasource URL stays in `prisma.config.ts` — no `url` is added to the `datasource db {}` block in `schema.prisma`.

~~**No backfill script.** Rationale: minimal/no real benefit data exists in `prisma/dev.db`, and CONSTRAINT-06 (re-scrape deletes and replaces ALL benefits for a card — no merge) means the next scrape+confirm of any card writes correct `classification`/`tracked` values for every benefit via the classification module. A backfill would be redundant work that the existing replace-all flow performs correctly on next use.~~

**Backfill (post-Task 34 reversal):** The no-backfill stance above was reversed on 2026-05-19 when ~33 pre-Task-29 `Benefit` rows were discovered in the live `prisma/dev.db` stuck at the column default (`classification = "one-time-bonus"`, `tracked = false`) — they predated the additive Task 29 migration and never went through a re-scrape. A one-off utility, `scripts/backfill-classification.ts`, was created to re-classify them in place by synthesizing `{name, description}` raw text per benefit, routing it through the canonical `parseBenefits()` (Haiku + tool_use, CONSTRAINT-09) and `deriveTracked()` (the deterministic policy in `src/lib/parser/classification.ts`), then updating only the `classification` and `tracked` columns (CONSTRAINT-07 honored — `usedAmount` and period history untouched). The script supports `--dry-run` and logs per-row results. CONSTRAINT-06 (re-scrape deletes/replaces all benefits — no merge) remains the long-term invariant; the backfill script is a one-off migration, not a recurring path. See `docs/session-log.md` 2026-05-19 for diagnosis details.

#### Field standardization (resolved)

Resolved 2026-05-15: standardized to a single field `tracked` across PRD, architecture, and API spec. `isTrackable` is retired — do not reintroduce.

### Set-and-Forget Benefits (Feature 8)

Added 2026-05-21 via `@cto`. Some benefits (Walmart+, Uber One, CLEAR, Oura, digital-entertainment credits) reimburse a membership the user enrolls in once, then recur automatically with no per-period action. They need a **period-independent activation state** — the per-period `BenefitPeriod.usedAmount` cannot express it, because the period engine zeroes `usedAmount` on every reset.

**Two new `Benefit` fields:**
- **`setAndForget`** (`Boolean`, default `false`) — classifier output. Derived deterministically in `src/lib/parser/classification.ts` (same discipline as `tracked` — the LLM may hint via the tool schema but never sets it). `true` = one setup action makes the value auto-recur.
- **`activatedAt`** (`DateTime?`) — user-facing activation state. `null` = not set up; a timestamp = active. Period-independent (lives on `Benefit`, mirroring `UserCard.lastVerifiedAt`). Toggling off sets it back to `null`.

**No `BenefitPeriod` records.** A `setAndForget = true` benefit has no per-period usage — its entire state is `activatedAt`. `ensureCurrentPeriod()` and initial period creation skip set-and-forget benefits (guard on `setAndForget`). Binding — see CONSTRAINT-17. Consequence: no per-period history for these benefits (intentional).

**Write path.** Activation is toggled via a new `setBenefitActivation(benefitId, activated)` in `src/lib/engine/usage.ts` — it writes `Benefit.activatedAt` only, never `usedAmount`, so CONSTRAINT-07 is unaffected. It is the sole write path for `activatedAt` (CONSTRAINT-16). A dedicated API route is required (specced in `docs/api-spec.md` during task breakdown).

**Triage.** `src/lib/engine/expiring.ts` (`buildOverviewTriage` + helpers) branches on `setAndForget`: an `active` benefit is excluded from "needs attention" / expiring-soon / money-at-risk and its `value` counts toward the realized/secured total; a `not set up` benefit renders calm — no urgency.

**UI.** The Cards space renders set-and-forget benefits in a distinct "Automatic" group with a sticky toggle; `src/components/cards/benefit-item.tsx` dispatch gains a `setAndForget` branch ahead of the per-`type` widget routing. Visual treatment → `@designer`.

**Migration.** One additive Prisma migration adds both fields with safe defaults (`false` / `null`); existing benefits are unaffected until a re-scrape re-classifies them. No backfill. Per CONSTRAINT-06, activation does not survive a re-scrape (re-scrape deletes and replaces all benefits) — the user re-activates afterward; an accepted trade-off (see `docs/founder-brief.md` FB15).

**Scope.** "Fix only" per `docs/prd.md` Feature 8 — the activation nudge, a `dismissed` state, and annual re-confirmation are explicitly out of scope.

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

- `genericScrape(url, issuer)`: two-path content extraction pipeline.
  1. **HTTP fast path** — `fetch(url)` with realistic User-Agent + Accept headers; parse the HTML with `jsdom`; run `@mozilla/readability` to extract the main article text. If the extracted text exceeds ~1.5KB, return it. Sub-second on most marketing pages; no browser launched.
  2. **Playwright fallback** — when the fast path returns too little (JS-shell-only page, paywall, redirect) or `fetch` fails, launch headless Chromium, navigate with `waitUntil: 'networkidle'` (timeout-tolerant — analytics scripts never settle), auto-scroll to trigger lazy loads, click visible expanders (`[aria-expanded="false"]`, `<summary>`, buttons matching `/show more|see details|view (all )?benefits?|read more|expand/i`), then run Readability on the post-expansion HTML. Falls back to `document.body.innerText` if Readability finds no article.
- `scrapeCard(issuer, url)`: dispatcher. Currently routes every issuer through `genericScrape`. The `ISSUER_SCRAPERS` map is retained as an empty extension point for future per-bank quirks (e.g., Amex anti-bot stealth, Chase login walls) — populate only when a specific bank cannot be handled by the generic pipeline.
- All scrapers use a realistic User-Agent (Chrome 124 on macOS) and 1280×800 viewport.
- Browser closed in `finally` block — no leaked processes.
- 30-second Playwright nav timeout; 10-second HTTP fast-path timeout.
- Returns text ≥200 chars or throws `ScraperError({ url, issuer, reason })`.
- ScraperError → API returns `200 { benefits: [], scrapeError }` so the review gate surfaces manual entry (CONSTRAINT-10).

---

## Claude Haiku Parser

`src/lib/parser/`

- Model: `claude-haiku-4-5-20251001` — never substituted
- Always uses `tool_use` — never freeform JSON parsing (CONSTRAINT-09 intact: Haiku only, tool_use only, no freeform JSON fallback)
- Tool schema fields: name, description, type (enum), value, valueUnit (enum: dollars|points), resetPeriod (enum), resetAnchor (enum), category (enum), **classification (required, enum-constrained to the 5 buckets: `discretionary-credit` | `activation-perk` | `auto-earn` | `passive-perk` | `one-time-bonus`)**, confidence — the LLM does NOT emit `tracked` (server-derived from `classification`)
- `classification` is a **required** field in the `tool_use` input schema (`BENEFIT_EXTRACTION_TOOL` in `src/lib/parser/schema.ts`), constrained to the 5 bucket strings via the JSON-schema `enum`. The LLM assigns the bucket only — it does NOT emit `tracked`. `tracked` is derived post-parse by `src/lib/parser/classification.ts` (see Data Model § Classification → tracked policy module). An ambiguous benefit Haiku cannot confidently bucket defaults to `discretionary-credit` (conservative trackable — see PRD Feature 3.5 edge cases, assumptions A10)
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
| GET | `/api/overview` | Urgency triage: money-at-risk + needsAttention/onTrack/done |

All routes: `requireAuth()` called first — 401 if no session.

---

## Infrastructure + Deployment

```
# Dev
next dev -p 3002

# Production (local)
next build && next start -p 3002
```

- Access: `http://localhost:3002` (desktop only for MVP)
- SQLite file: `prisma/dev.db` — local, gitignored
- Playwright Chromium: `npx playwright install chromium` on first setup
- No CI/CD, no cloud hosting, no serverless — MVP is local only
- Vercel migration is Phase 2 (see assumptions A9 — requires Postgres + external scraping)

### Required .env

```
NEXTAUTH_URL=http://localhost:3002
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
