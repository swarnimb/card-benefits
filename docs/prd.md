# PRD: CardMaxxer

> Produced by `@plan` — 2026-04-07
> Source: `docs/kickoff-brief.md`, `docs/design-decisions.md`, `docs/assumptions.md`

---

## Product Goal

A personal dashboard where Swarnim tracks all credit card benefits in one place — never missing a reset, never leaving a credit unused.

**Platform:** Mobile-first web app (375px minimum). Desktop supported.
**Deployment:** Local machine + Tailscale. No cloud hosting.
**Users:** Single user (Swarnim) in MVP. Auth architected for multi-user later.

---

## Feature 1: Authentication

Single user, local deployment. NextAuth credentials provider (email + password from `.env`).

### User Flow

1. Navigate to app URL → if unauthenticated → `/login`
2. Email + password form → submit → session created → redirect to `/overview`
3. Sign out available in Admin space → clears session → redirects to `/login`

### Edge Cases

- Wrong credentials → inline error "Invalid credentials"
- Session expired → redirect to `/login`
- All routes except `/login` are protected

### Acceptance Criteria

- [ ] Given unauthenticated user, when visiting any route, then redirect to `/login`
- [ ] Given valid credentials, when submitted, then session JWT created and redirect to `/overview`
- [ ] Given invalid credentials, when submitted, then inline error shown, no redirect
- [ ] Session persists across browser refresh (30-day JWT expiry)
- [ ] Sign out clears session and redirects to `/login`

### Explicitly Excluded

- OAuth (Google, GitHub) — post-MVP
- Multi-user invite flow — post-MVP
- Password reset — handle via `.env` change

---

## Feature 2: Card Setup — Add Card

Pre-seeded catalog of known cards. User selects cards from the catalog. Custom card option for cards not in the catalog.

### Catalog (MVP)

| Issuer | Cards |
|---|---|
| Chase | Sapphire Preferred, Sapphire Reserve, Freedom Unlimited, Freedom Flex |
| Amex | Gold, Platinum, Blue Cash Preferred, Blue Cash Everyday |
| Capital One | Venture X, Venture, Quicksilver |
| Citi | Strata Premier, Double Cash |
| Discover | it Cash Back |
| Wells Fargo | Active Cash |

Custom card: issuer + name text entry. No scrape URL — manual benefit entry only.

### Add Card Flow

1. Admin → "Add Card" → catalog picker (accordion by issuer)
2. Tap card → confirm → scrape + parse triggered automatically
3. Review Gate shown → user confirms benefits → card saved
4. Card appears in Cards space

### Remove Card Flow

1. Admin → card row → "Remove Card"
2. Confirmation dialog: "Remove [Card Name]? All benefits and usage history will be deleted."
3. Confirm → card + all benefits + all period history deleted

### Acceptance Criteria

- [ ] User can add any catalog card
- [ ] User can add a custom card (issuer + name only)
- [ ] Each card shows "Last verified: [date]" or "Never verified"
- [ ] Adding a card triggers scrape automatically (not deferred)
- [ ] Remove requires confirmation dialog before delete
- [ ] Removing a card cascades: deletes all Benefits + all BenefitPeriods

---

## Feature 3: Benefit Ingestion (Scrape → Parse → Review → Confirm)

**Pipeline:** Playwright scrapes card URL → raw text → Claude Haiku `tool_use` → structured draft → Review Gate → user confirms → saved.

### Step-by-Step

1. Scrape triggered (on add or "Refresh Benefits")
2. Loading state: "Fetching... → Parsing... → Done" (step labels, not just spinner)
3. Playwright navigates to card's URL, extracts `document.body.innerText`
4. Claude Haiku `tool_use` returns structured benefit array
5. Review Gate displays all parsed benefits, editable inline:
   - Edit any field: name, description, type, value, resetPeriod, resetAnchor, category
   - Delete a row (×)
   - Add manual row ("Add benefit")
6. User taps "Save [N] benefits" → all written in one DB transaction
7. `lastVerifiedAt` updated on UserCard

### Failure Handling

- Scrape fails (bot-blocked, timeout): Review Gate opens empty + amber banner ("Scrape failed — add benefits manually below")
- Parse returns 0 benefits: Review Gate opens empty + amber banner ("No benefits found — add manually or try again")
- Custom card (no URL): Review Gate opens empty immediately (no scrape attempted)

### Re-scrape Behavior (Q1-A: Replace)

- Same pipeline as initial scrape
- On confirm: ALL existing benefits for that card deleted and replaced with review gate contents
- Usage history (BenefitPeriods) deleted with old benefits
- `lastVerifiedAt` updated

### Acceptance Criteria

- [ ] Loading state shows named steps (not just spinner)
- [ ] Review Gate edits are reflected in saved data (not original parsed values)
- [ ] User can delete any benefit from review gate
- [ ] User can add a manual benefit row
- [ ] "Save [N] benefits" disabled when 0 rows
- [ ] Successful save: all benefits written in one transaction, `lastVerifiedAt` updated
- [ ] Scrape failure: Review Gate opens with amber error banner, manual entry available
- [ ] Re-scrape: on confirm, all existing benefits + periods deleted before new ones saved
- [ ] No benefit ever auto-saved without user confirmation

---

## Feature 4: Manual Usage Tracking

### Tracking UI Per Benefit Type

| Type | UI | Behavior |
|---|---|---|
| `credit` | Slider + number input | Drag or type. Save on pointer release / blur. Clamp [0, value]. |
| `perk` | Slider + number input | Same as credit |
| `subscription` | Toggle | "Not claimed" / "Claimed". Save on click. |
| `access` | +/- Counter | Min 0. Max = `value` if set, else uncapped. Save on each tap. |

All writes go through `updateBenefitUsage()` — no direct DB writes elsewhere.

### Period Tracking

- `usedAmount` stored in current open `BenefitPeriod`
- Period expires → old period closed, new period opened, `usedAmount` resets to 0
- Period advance is **automatic and silent** — on next API call after reset date (Q2-A)
- No user action required to trigger reset

### Optimistic Updates

- UI updates immediately on interaction
- API call runs in background
- Failure: revert UI + show inline error on affected benefit item

### Acceptance Criteria

- [ ] Slider: live preview during drag, DB write on pointer release only
- [ ] Input: synced with slider, DB write on blur/Enter, clamped to [0, benefit.value]
- [ ] Toggle: flips 0 ↔ 1, DB write on click
- [ ] Counter: +/- by 1, DB write on each tap, min 0, max = benefit.value if set
- [ ] Uncapped access (value = null): no max, shows "N visits" without denominator
- [ ] All writes go through `updateBenefitUsage()`
- [ ] Optimistic: UI reflects immediately; reverts on failure with inline error
- [ ] `resetPeriod: 'once'`: usedAmount never auto-resets

---

## Feature 5: Reset Timeline + Expiring Soon Alerts

### Period Boundaries

| resetPeriod | resetAnchor | Period |
|---|---|---|
| monthly | calendar | 1st → last day of current calendar month |
| quarterly | calendar | 1st → last day of current calendar quarter |
| annual | calendar | Jan 1 → Dec 31 of current year |
| monthly | statement | Last statement day → next statement day − 1 |
| annual | anniversary | Last anniversary → next anniversary − 1 day |
| once | any | No period end — usedAmount never resets |

Default anchor: `calendar` (applied when scraper cannot determine anchor type).

### Expiring Soon Definition

A benefit is "expiring soon" if ALL:
- `isTrackable = true`
- `resetPeriod ≠ 'once'`
- `periodEnd` within 7 days of today
- Unused value > 0:
  - credit/perk: `usedAmount < benefit.value`
  - subscription: `usedAmount === 0`
  - access with cap: `usedAmount < benefit.value`
  - access uncapped: never expiring

### Where Displayed

- **Overview:** Expiring Soon section at top (amber), sorted by daysUntilReset ASC
- **Cards space:** Amber "⚠ Resets in N days" label on affected benefit row
- **Cards space:** Amber `⚠` badge on card in stack if any benefit expiring

### Acceptance Criteria

- [ ] Period boundary correct for all 6 combinations
- [ ] "Expiring soon" only when periodEnd ≤ today + 7 AND unused value > 0
- [ ] Expiring benefits shown with amber styling in both spaces
- [ ] "Resets in N days" label is integer day count
- [ ] `resetPeriod: 'once'` benefits never appear in expiring soon

---

## Feature 6: Three Spaces

### Overview Space

- Aggregates `credit` and `perk` benefits only — subscription + access excluded
- Grouped by category; per group: total available vs. total used
- Tap category row → expands to per-card breakdown
- Expiring Soon section at top (amber) when any benefits resetting within 7 days
- Empty categories (0 available) not shown

### Cards Space (Apple Wallet Stack)

- Scrollable vertical stack, scroll snap
- Scroll-driven scale: center card = 1.0 / 1.0; adjacent = 0.92 / 0.75 opacity
- Tap focused card → card lifts, benefits slide up
- Benefits grouped per card: Credits → Subscriptions → Access → One-time Perks
- Tracking UI inline (slider, toggle, counter)
- Tap expanded card again → collapse

### Admin Space

- Card list: name, issuer, "Last verified", benefit count, "Refresh Benefits", "Remove"
- "Add Card" → catalog picker
- Per card: list of benefits (editable), "Add benefit", individual delete
- Functional over beautiful — forms + lists, less animation than Cards/Overview

### Acceptance Criteria

- [ ] Overview: credit + perk only; subscription + access excluded
- [ ] Overview: empty categories not shown
- [ ] Cards: scroll-driven scale + snap works for 1–10 cards
- [ ] Cards: only one card expanded at a time
- [ ] Admin: editing a benefit reflects in Cards and Overview immediately after save
- [ ] Admin: removing a benefit removes it from all spaces
- [ ] Each space has appropriate empty state

---

## Feature 7: Period Auto-Reset

When app detects benefit period has ended:
- Old BenefitPeriod → status set to `'closed'`
- New BenefitPeriod created → `usedAmount = 0`
- Detection on API call (lazy) — **no cron job** (Q2-A: silent auto-reset)
- Closed records never mutated

### Acceptance Criteria

- [ ] When `periodEnd < today`, next API call closes it and opens a new one
- [ ] New period `usedAmount = 0`
- [ ] Closed BenefitPeriod records never updated after closing
- [ ] `resetPeriod: 'once'` periods never auto-close

---

## Out of Scope (MVP)

- CSV transaction import or auto-matching
- Recommendation engine
- Native mobile app
- Plaid / bank API integration
- LLM optimization suggestions
- Usage history reports (past-period summary)
- Multi-user support (architected for, not implemented)
- Diff view on re-scrape (replace is current behavior — post-MVP)
