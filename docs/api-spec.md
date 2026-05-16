# API Spec: CardMaxxer

> Produced by `@plan` — 2026-04-07
> 12 routes. Threshold: >8 endpoints → this file required.
> All routes require auth. `requireAuth()` called first — returns 401 if no session.
> `userId` always from session (`getUserId()`), never from request body.

---

## Auth Routes

### NextAuth Handler
`/api/auth/[...nextauth]` — handled by NextAuth internally. Not documented here.

---

## Catalog

### GET /api/catalog

Returns all cards from `data/card-catalog.json`.

**Auth:** Required

**Response 200:**
```typescript
CatalogCard[] // [{id, issuer, name, scrapeUrl: string|null, defaultColor}]
```

**Notes:**
- Reads static JSON file — no DB query
- Used by AddCardModal to populate the catalog picker

---

## User Cards

### GET /api/user-cards

Returns the authenticated user's cards, ordered by `displayOrder ASC`.

**Auth:** Required

**Response 200:**
```typescript
{
  id: string
  cardId: string
  displayOrder: number
  lastVerifiedAt: string | null  // ISO date string
  statementDay: number | null
  anniversaryDate: string | null
  benefitCount: number
  card: {
    id: string
    issuer: string
    name: string
    defaultColor: string
    scrapeUrl: string | null
  }
}[]
```

---

### POST /api/user-cards

Adds a card to the user's list. Two variants:

**Auth:** Required

**Request body (catalog card):**
```typescript
{ catalogCardId: string }
```

**Request body (custom card):**
```typescript
{ customIssuer: string; customName: string }
```

**Behavior (catalog card):** Look up card in `card-catalog.json` by `catalogCardId`. Insert `UserCard` with userId from session. Card row already seeded — no Card insert needed.

**Behavior (custom card):** Insert `Card` row with `scrapeUrl: null`, `defaultColor: "#64748b"` (slate). Then insert `UserCard`.

**Response 201:**
```typescript
{ id: string; cardId: string; card: { issuer: string; name: string } }
```

**Response 400:** `{ error: "Missing catalogCardId or customIssuer+customName" }`

**Response 409:** `{ error: "You already have this card" }` (@@unique violation)

---

### PATCH /api/user-cards/[id]

Update allowed fields on a UserCard.

**Auth:** Required. 403 if UserCard does not belong to session user.

**Allowed fields:** `displayOrder`, `statementDay`, `anniversaryDate`
Unknown fields silently stripped (no error).

**Request body:** `{ displayOrder?: number; statementDay?: number; anniversaryDate?: string }`

**Response 200:** Updated `UserCard`

**Response 404:** UserCard not found

**Response 403:** UserCard belongs to different user

---

### DELETE /api/user-cards/[id]

Remove a UserCard and cascade-delete all Benefits + BenefitPeriods.

**Auth:** Required. 403 if wrong user.

**Response 200:** `{ ok: true }`

**Response 404:** UserCard not found

**Response 403:** Wrong user

---

### POST /api/user-cards/[id]/scrape

Trigger Playwright scrape + Claude Haiku parse. Returns draft benefits. **No DB write.**

**Auth:** Required. 404 if UserCard not found for this user.

**Response 200 (success):**
```typescript
{ benefits: DraftBenefit[] }
```

`DraftBenefit` carries the classification model fields so the review gate can render excluded items collapsed (Feature 3.5):
```typescript
DraftBenefit {
  name: string
  description?: string
  type: "credit" | "subscription" | "access" | "perk"
  value?: number
  valueUnit: "dollars" | "points"
  resetPeriod: "monthly" | "quarterly" | "annual" | "once"
  resetAnchor: "calendar" | "statement" | "anniversary"
  category: "dining" | "travel" | "streaming" | "shopping" | "lounge" | "general"
  classification: "discretionary-credit" | "activation-perk" | "auto-earn" | "passive-perk" | "one-time-bonus"  // assigned by Haiku tool_use
  tracked: boolean   // derived deterministically from classification by src/lib/parser/classification.ts — NOT from the LLM
  confidence: number
}
```

**Notes (classification):**
- `classification` is set by the Haiku `tool_use` parse; `tracked` is computed server-side from `classification` via `src/lib/parser/classification.ts` before the draft is returned — the client never receives an LLM-set `tracked`.
- The review gate renders `tracked: true` benefits prominently and `tracked: false` benefits collapsed behind a summary ("N auto-excluded — expand to review"). No DB write occurs here (CONSTRAINT-10) — this is still a draft.

**Response 200 (scrape failure):**
```typescript
{
  benefits: []
  scrapeError: string  // e.g. "Timeout after 30s" or "Custom card — no scrape URL. Add benefits manually."
}
```

**Response 200 (parse failure):**
```typescript
{ benefits: []; parseError: string }
```

**Notes:**
- Always returns 200 for expected failures (ScraperError, ParserError) — client handles these as non-fatal
- Unexpected errors (unhandled exceptions) return 500 with server-side logging
- Long-running: ~15-30 seconds. Client shows loading state during this window.

---

## Benefits

### GET /api/benefits/[userCardId]

Returns all benefits for a UserCard, with current period data. Calls `ensureCurrentPeriod()` for each trackable benefit — **this route has a write side-effect** (period advance).

**Auth:** Required. 403 if UserCard does not belong to session user.

**Response 200:**
```typescript
{
  id: string
  name: string
  description: string | null
  type: "credit" | "subscription" | "access" | "perk"
  value: number | null
  resetPeriod: "monthly" | "quarterly" | "annual" | "once"
  resetAnchor: "calendar" | "statement" | "anniversary"
  category: "dining" | "travel" | "streaming" | "shopping" | "lounge" | "general"
  tracked: boolean
  currentPeriod: {
    id: string
    periodStart: string   // ISO date
    periodEnd: string | null
    usedAmount: number
    status: "open"
  } | null  // null when tracked=false
}[]
```

Benefits sorted: credit → subscription → access → perk.

---

### POST /api/benefits/confirm

Bulk-save confirmed benefits for a UserCard. **Replaces all existing benefits for that card.**

**Auth:** Required. 403 if UserCard does not belong to session user.

**Request body:**
```typescript
{
  userCardId: string
  benefits: {
    name: string
    description?: string
    type: "credit" | "subscription" | "access" | "perk"
    value?: number
    resetPeriod: "monthly" | "quarterly" | "annual" | "once"
    resetAnchor?: "calendar" | "statement" | "anniversary"
    category: "dining" | "travel" | "streaming" | "shopping" | "lounge" | "general"
    classification: "discretionary-credit" | "activation-perk" | "auto-earn" | "passive-perk" | "one-time-bonus"
    tracked?: boolean   // accepted but authoritative value is re-derived server-side from classification
  }[]
}
```

**Classification handling:** `classification` is validated against the 5-bucket allowlist (400 on invalid, same pattern as other enum-like fields — CONSTRAINT-01: app-level validation, not a DB enum). The server does NOT trust a client-supplied `tracked`: it re-derives `tracked` from `classification` via `src/lib/parser/classification.ts` before insert, so the persisted `tracked` always matches policy. Excluded benefits (`tracked: false`) are persisted, never dropped (Feature 3.5).

**Transaction (atomic):**
1. DELETE all existing `Benefit` for `userCardId` (cascades to `BenefitPeriod`) — CONSTRAINT-06 (replace-all, no merge)
2. For each benefit: derive `tracked` from `classification` via `src/lib/parser/classification.ts`
3. INSERT new `Benefit` rows (including `classification` and the derived `tracked`)
4. For each tracked benefit: INSERT initial open `BenefitPeriod` using `calculatePeriodBoundary()`
5. UPDATE `UserCard.lastVerifiedAt = now()`

**Response 200:** `{ saved: number }` (count of benefits saved)

**Response 400:** `{ error: "benefits must not be empty" }` when array length = 0

**Response 400:** `{ error: "Invalid value for field [field]: [value]" }` on invalid enum (includes `classification` not in the 5-bucket allowlist)

**Response 403:** UserCard belongs to different user

---

### PATCH /api/benefits/[id]

Edit fields on an existing Benefit.

**Auth:** Required. Ownership verified: Benefit → UserCard → userId. 403 if mismatch.

**Allowed fields:** `name`, `description`, `type`, `value`, `resetPeriod`, `resetAnchor`, `category`
Unknown fields silently stripped.

> **Note:** `tracked` and `classification` are NOT client-editable. `classification` is LLM-assigned and correctable only at the review gate (POST `/api/benefits/confirm`) before save; `tracked` is always server-derived from `classification` via the classification policy module. Post-save, both change only via re-scrape (constraint 06: re-scrape replaces all benefits). No direct PATCH or manual-override path exists in MVP.

**Request body:** Any subset of allowed fields.

**Special behavior:** If `type` changes, reset current open `BenefitPeriod.usedAmount = 0` in same transaction.

**Response 200:** Updated Benefit with current period

**Response 400:** Invalid enum value

**Response 403:** Wrong user

**Response 404:** Benefit not found

---

### DELETE /api/benefits/[id]

Remove a single Benefit and cascade-delete its BenefitPeriods.

**Auth:** Required. Ownership verified. 403 if wrong user.

**Response 200:** `{ ok: true }`

**Response 403:** Wrong user

**Response 404:** Benefit not found

---

### POST /api/benefits/[id]/usage

Update `usedAmount` for the current open period. Delegates entirely to `updateBenefitUsage()`.

**Auth:** Required. Ownership verified. 403 if wrong user.

**Request body:**
```typescript
{ usedAmount: number }  // must be >= 0
```

**Response 200:**
```typescript
{
  id: string           // BenefitPeriod id
  usedAmount: number   // clamped to [0, benefit.value]
  periodStart: string
  periodEnd: string | null
  status: "open"
}
```

**Response 400:** `{ error: "usedAmount must be a number >= 0" }`

**Response 403:** Wrong user

---

## Overview

### GET /api/overview

Returns aggregated credit + perk benefits across all user cards, plus expiring-soon list.

**Auth:** Required.

**Response 200:**
```typescript
{
  categories: {
    name: "dining" | "travel" | "streaming" | "shopping" | "lounge" | "general"
    totalAvailable: number    // sum of benefit.value for this category
    totalUsed: number         // sum of currentPeriod.usedAmount for this category
    cards: {
      cardName: string
      issuer: string
      available: number
      used: number
    }[]
  }[]
  expiringSoon: {
    benefitId: string
    benefitName: string
    cardName: string
    issuer: string
    unusedAmount: number       // benefit.value - usedAmount
    daysUntilReset: number     // integer, >= 0
  }[]
}
```

**Notes:**
- Only `credit` and `perk` type benefits included in categories
- Empty categories (totalAvailable = 0) excluded from response
- `expiringSoon` sorted by `daysUntilReset` ASC (most urgent first)
- Calls `ensureCurrentPeriod()` for each trackable benefit — write side-effect on GET

---

## Error Response Format

All error responses follow this shape:
```typescript
{ error: string }
```

Server-side errors log full context. Client receives only the `error` message string — no stack traces exposed.

---

## Common Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created (POST /api/user-cards) |
| 400 | Bad request — invalid input |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized (wrong user) |
| 404 | Resource not found |
| 409 | Conflict (duplicate card) |
| 500 | Server error — logged server-side |
