# PRD: CardMaxxer

> Produced by `@plan` — 2026-04-07
> Source: `docs/kickoff-brief.md`, `docs/design-decisions.md`, `docs/assumptions.md`

---

## Product Goal

A personal dashboard where Swarnim tracks all credit card benefits in one place — never missing a reset, never leaving a credit unused.

**Platform:** Mobile-first web app (375px minimum). MVP runs desktop-only; mobile layout preserved for Phase 2.
**Deployment:** Local machine, desktop-only for MVP. Vercel migration is Phase 2 (see `docs/assumptions.md` A9).
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

## Feature 3.5: Benefit Classification & Tracking Model

### Problem Statement
The parser currently surfaces every benefit including auto-applied earn rates (e.g. 10% cash back) and passive entitlements (lounge access, insurance). These cannot be "missed" — they apply automatically or are always available — so tracking them is noise that buries genuinely missable credits. CardMaxxer's entire purpose is surfacing benefits a user would otherwise miss.

### User Story
As the cardholder, I want the system to automatically decide which benefits are worth tracking, so my dashboard only shows things I could actually miss — without me curating a list.

### Business Logic
- The Missability Test: track a benefit only if (1) realizing it requires deliberate action (not auto-applied to ambient spend) AND (2) inaction within a window loses the value.
- Every parsed benefit is classified into exactly one bucket:
  - `discretionary-credit` — recurring use-it-or-lose-it $ credit (spa, Uber, airline fee). **Tracked by default.**
  - `activation-perk` — requires enroll/activate/claim, may have a deadline (DashPass, Clear, free-night cert). **Tracked by default.**
  - `auto-earn` — auto-applied earn rate (cash back, points multiplier). **Excluded.**
  - `passive-perk` — always-available entitlement (lounge access, insurance, no-FX-fee). **Excluded.**
  - `one-time-bonus` — signup/min-spend welcome bonus. **Excluded (MVP).**
- The LLM (Haiku, tool_use) assigns the classification bucket as a structured field. Deterministic application code maps bucket → tracked default. The LLM never decides tracked directly — judgment (classification) and policy (tracked default) are separated so policy can change without re-prompting.
- Excluded benefits are persisted with tracked = false — never dropped. This preserves a future "view all / manually override" capability without re-scraping.
- Review gate: shows tracked benefits prominently; excluded benefits collapsed behind a summary ("N auto-excluded as non-trackable — expand to review"). The mandatory review gate / confirm flow is unchanged.

### Acceptance Criteria
- [ ] Given a scraped page with a cash-back earn rate, when parsed, then it is classified auto-earn and saved with tracked = false.
- [ ] Given a recurring $ credit, when parsed, then it is classified discretionary-credit and saved with tracked = true.
- [ ] Given any parse, when the review gate renders, then tracked benefits are prominent and excluded ones collapsed but present.
- [ ] Given confirmation, when benefits are saved, then excluded benefits persist with tracked = false (not discarded).
- [ ] The bucket→tracked mapping lives in deterministic code, not the LLM prompt.

### Edge Cases
- Ambiguous benefit the LLM cannot confidently bucket: default to the most conservative trackable bucket and rely on the review gate (better to show than silently hide). Document the default.
- Hybrid benefit (cap + auto-apply): classify by primary user action — if any deliberate redemption step exists, treat as discretionary-credit.

### Out of Scope (MVP)
- User-facing UI to view all benefits and manually toggle tracked (future — see Forward-Dependency).
- Per-user classification overrides.

### Forward-Dependency (documented risk — not MVP work)
Constraint 06 (re-scrape deletes and replaces all benefits, no merge) will conflict with the future user-override feature: a re-scrape would wipe manual track/untrack choices. MVP is unaffected (no override UI exists). When the override feature is built, constraint 06 must be revisited to preserve user overrides across re-scrape.

### Success Metric
After a scrape+confirm, the dashboard shows only missable benefits; zero auto-earn/passive items appear in tracked views, and none are lost from the database.

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
- `tracked = true`
- `resetPeriod ≠ 'once'`
- `periodEnd` within 7 days of today
- Unused value > 0:
  - credit/perk: `usedAmount < benefit.value`
  - subscription: `usedAmount === 0`
  - access with cap: `usedAmount < benefit.value`
  - access uncapped: never expiring

### Where Displayed

- **Overview:** Surfaced via the money-at-risk hero plus the 3 urgency sections — expiring-soon benefits appear in "Needs attention" (amber, urgency-sorted); active ones in "On track"; completed/no-action ones in the collapsed "Done" (see Overview Space spec)
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

_Updated 2026-05-15: Overview redesigned (urgency-primary). Supersedes prior skeleton spec. Single-page consolidation explicitly dropped — three-tab IA retained._

#### Problem Statement
Current Overview is skeleton-level — it lists benefits flatly without answering the only question that matters on open: "what am I about to lose, and what should I do today?" It feels generic and does not drive action.

#### User Story
As the cardholder, I want the Overview to immediately show money at risk and what to act on, so I never miss a resetting credit.

#### User Flow
1. User opens app → lands on Overview (three-tab IA retained; single-page consolidation explicitly dropped).
2. Sees a money-at-risk hero: total unredeemed trackable value resetting soon, time-framed (e.g. "$340 expiring in 12 days").
3. Scans "Needs attention" (expiring soon, amber), sorted by urgency.
4. Below, "On track": active trackable benefits with remaining value/time.
5. "Done / nothing to do" collapsed by default.

#### Business Logic
- Overview shows only benefits where tracked = true (see Benefit Classification & Tracking Model).
- Primary section axis = urgency/state, NOT benefit type. Exactly 3 sections: Needs attention, On track, Done (collapsed).
- Benefit type (spend-down vs. flip-on), category, and source card are row-level metadata (chip/icon/accent) — never their own sections.
- Cards tab is unchanged — retains the 4 type-groups ($Credits / Subscriptions / Access / One-time Perks). Overview = triage by urgency; Cards = inventory by type. Intentional difference.
- Visual system per docs/design-decisions.md (dark #0F0E0D, amber #F59E0B for expiring, Inter, amounts as headline, Framer Motion).

#### Acceptance Criteria
- [ ] Given tracked benefits with upcoming resets, when Overview loads, then a money-at-risk hero shows total at-risk value with a time frame.
- [ ] Given a benefit expiring soon, when Overview loads, then it appears in "Needs attention" with amount remaining, deadline, and source card.
- [ ] Given a fully-used or no-action benefit, when Overview loads, then it is in the collapsed "Done" section.
- [ ] Given a benefit with tracked = false, when Overview loads, then it does not appear anywhere on Overview.
- [ ] Overview renders correctly at 375px.

#### Edge Cases
- No trackable benefits yet: empty state guides user to add/scrape cards (no scary zeros).
- Nothing expiring soon: "Needs attention" hides; hero reflects calm state.
- All benefits done this period: hero shows a positive "nothing at risk" state.

#### Out of Scope
- Single-page wallet-stack consolidation (explicitly dropped this session — three-tab IA retained).
- Charts/graphs beyond the money-at-risk hero (future).
- User reordering of sections.

#### Success Metric
On open, user identifies the single most urgent action in under 5 seconds without scrolling.

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

- [ ] Overview shows only benefits where `tracked: true`; organized by urgency (Needs attention / On track / Done), not by benefit type or category. See the Overview Space spec for full acceptance criteria.
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

## Feature 8: Set-and-Forget Benefits

> Added 2026-05-21 via `@cpo`. Scope: "Fix only" per builder decision — see Out of Scope.

### Problem Statement
CardMaxxer prompts the user to mark usage on every tracked benefit, every reset period. But a subset of benefits — those that reimburse a recurring membership the user enrolls in once (e.g. Walmart+, Uber One, CLEAR, Oura, digital-entertainment credits) — need a single setup action and then pay out automatically, with no further action. Tracking these as per-period to-dos generates ~11 months/year of false tasks per benefit, burying genuine use-it-or-lose-it urgency. The user hit this directly while reviewing a scraped Amex Platinum benefit list (2026-05-21).

### User Story
As a CardMaxxer user, I want benefits that I set up once and that then recur automatically to stay marked as handled, so that I am only prompted to act on benefits that genuinely need recurring action.

### User Flow
1. The user re-scrapes a card. The parser classifies each benefit; benefits meeting the set-and-forget rule (Business Logic) are identified.
2. In the review gate (unchanged), the benefits appear and the user confirms/saves them.
3. On the Cards space, set-and-forget benefits appear in a distinct, calm "Automatic" group — separate from the per-period benefit list.
4. A set-and-forget benefit starts in the `not set up` state, shown as "Set up". The user taps it once to mark it `active` ("✓ Active").
5. The `active` state is permanent: it persists across every reset period. The user is never prompted to re-mark that benefit.
6. If the user later cancels the underlying service, they tap the benefit again to return it to `not set up`.

### Business Logic
- **Set-and-forget rule:** a benefit is set-and-forget when a single setup action makes its value recur automatically with no further per-period action. Discriminator: *one decision* (enroll in a recurring membership) vs. *a recurring decision* (actively spend each period). In: Walmart+, Uber One, CLEAR, Oura, digital-entertainment credits. Out: airline fee credit, hotel credit, Resy dining credit, Uber Cash (monthly credit the user must actively spend).
- The set-and-forget determination is made at parse time by the classifier (Haiku + deterministic override), consistent with the bucket→tracked model in Feature 3.5. The LLM never decides activation state.
- Annual one-shots (CLEAR) and monthly auto-recurring benefits (Walmart+) are the **same class**. `resetPeriod` is retained for value math but drives no user prompt for these benefits.
- A set-and-forget benefit has a binary, **period-independent** activation state: `not set up` / `active`. This state does NOT reset on period rollover (unlike `usedAmount`, which is per-period).
- An `active` set-and-forget benefit is treated as fully realized every period: excluded from "expiring soon" / "needs attention" / money-at-risk, and its value counts toward the realized/secured total in the Overview.
- A `not set up` set-and-forget benefit shows calmly in the "Automatic" group — no urgency styling, no prompt.
- Set-and-forget benefits remain `tracked: true` but are exempt from per-period usage tracking.
- The activation toggle is a usage write and goes through the single write path (`updateBenefitUsage()` or equivalent, per Feature 4) — no direct DB writes.

### Acceptance Criteria
- [ ] Given an `active` set-and-forget benefit, when its reset period rolls over, then its state remains `active` — the user is not re-prompted.
- [ ] Given an `active` set-and-forget benefit, when the Overview computes "needs attention" / expiring-soon / money-at-risk, then the benefit is excluded.
- [ ] Given an `active` set-and-forget benefit, when the Overview computes realized/secured value, then the benefit's value is included.
- [ ] Given a set-and-forget benefit, when shown on the Cards space, then it appears in the "Automatic" group, not the per-period benefit list.
- [ ] Given a `not set up` set-and-forget benefit, then it shows no urgency styling and produces no prompt.
- [ ] Given the user taps an `active` set-and-forget benefit, then it returns to `not set up`.
- [ ] Given "Uber Cash" (a monthly credit the user must actively spend), then it is NOT classified set-and-forget — it remains a per-period tracked benefit.

### Edge Cases
- **Classifier mis-types a benefit:** the existing review gate is the catch — the user reviews all benefits before save. Review gate behavior is unchanged.
- **Annual one-shot (CLEAR):** treated identically to a monthly set-and-forget benefit — one toggle, sticky. No special case.
- **Re-scrape replaces all benefits (CONSTRAINT-06):** a re-scrape deletes and recreates a card's benefits, so a previously-`active` benefit returns to `not set up` after a re-scrape. Acceptable here (re-scrapes are infrequent and already discard all usage history). Whether activation state should survive a re-scrape is an `@cto` implementation decision — not required for this feature.
- **Distinction from `resetPeriod: 'once'`:** a `once` benefit is genuinely one-time (signup bonus); a set-and-forget benefit's *value* recurs every period — only the user's *action* is one-time. Different concepts, though both are excluded from expiring-soon.

### Out of Scope
- Proactive activation nudge for un-set-up benefits ("CLEAR: $209/yr available, not claimed") — deferred (builder decision 2026-05-21: "Fix only").
- A `dismissed` / "not interested" state — deferred with the nudge.
- Annual re-confirmation / silent-breakage safety check — deferred to a future version.
- Visual design of the "Automatic" group — `@designer`.
- Implementation: the new period-independent activation field, period-engine changes, expiring-soon changes — `@cto` (architecture) → `@create-plan` (tasks).
- Classifier implementation (the deterministic set-and-forget override) — `@llm-parser`, planned in `@create-plan`.

### Success Metric
A user re-scrapes a card with set-and-forget benefits, activates them once, and across subsequent reset periods sees zero prompts for those benefits — only recurring-action benefits appear in the "needs attention" lane.

---

## Feature 9: Pixel-Perfect Three-Screen Redesign

### Problem Statement
The Overview, Cards, and Admin screens work but predate a finalized visual design. The builder now has a complete claude.ai/design reference and wants all three rebuilt to match it like-to-like — premium and cohesive, not functional-but-rough.

### User Story
As the single user, I want all three screens to exactly match the approved design, so the app feels like a finished premium product I use daily.

### User Flow (deltas from current screens)
- **Overview:** greeting topbar → money-at-risk hero (count-up + issuer sparkbar) → Expiring-soon urgency cards → Active-credits category accordion → Settled (collapsed).
- **Cards:** portfolio stat trio (annual fees / redeemed YTD / available) → wallet stack (existing expand/collapse animation preserved) → card detail with stat trio + credit sections.
- **Admin:** summary strip (cards · tracked · issuers) → Add a card → managed-card rows (rescan / delete) → add flow (picker → scanning → review gate with confidence badges) → toast on add/remove.

### Business Logic
- New design tokens are the single source of truth; the two existing palettes (`OV.*` and the ui-cardmaxxer skill palette) are reconciled into one.
- Active-credits groups by category. Mapping (6 existing → 4 design groups): **Dining** ← dining; **Travel** ← travel, lounge; **Lifestyle** ← streaming, shopping, general; **Wellness** ← reserved (renders only if a benefit matches wellness keywords, else hidden). Empty groups are hidden. Final mapping confirmed at build with `@designer`.
- **Annual fee:** scrape-derived (extracted in the Haiku parse pass), stored on `Card.annualFee` (product-level), pre-filled and confirmable in the review gate, displayed on Cards/Admin. Null renders "—". (CONSTRAINT-21)
- **Review confidence:** the parser emits a `confidence` (high/low) + optional `note` per draft benefit; this drives the amber "Review" badge in the review gate only and is never persisted.
- **Toasts:** permitted for card add/remove confirmations only; benefit tracking stays inline-feedback-only. (CONSTRAINT-20)
- **Value figures:** redeemed-YTD / available / annual-fee totals appear on Cards/Admin only; the Overview hero stays money-at-risk only. (CONSTRAINT-18, CONSTRAINT-19)

### Acceptance Criteria
- [ ] Given the design at 375px, each screen is visually indistinguishable on sample data (Overview: topbar/hero/sparkbar/accordion/settled; Cards: stat trio/stack/detail; Admin: summary/list/add-scan-review flow).
- [ ] The Cards stack expand/collapse animation is preserved unchanged.
- [ ] The Overview hero shows money-at-risk only; redeemed/available figures appear only on Cards/Admin.
- [ ] `annualFee` is scrape-derived and confirmed in the review gate (never manually required); when null it renders "—".
- [ ] Review confidence/note are review-time only and never written to the DB.
- [ ] All three screens render from one reconciled token palette.
- [ ] Verified at 375px AND 1280px per `skills/ui-cardmaxxer.md`.

### Edge Cases
- Annual fee not found on the scraped page → `annualFee` null → "—" everywhere, no error.
- Empty category group → hidden (accordion renders only non-empty groups).
- Long benefit or card names → truncate with ellipsis per design.
- Zero cards → existing empty states restyled to the design.

### Out of Scope (Feature 9)
- `last4`, opened date, and network logo on the card face (dropped — card face omits them).
- Real card-network detection or brand/merchant logos.
- New benefit categories beyond the existing 6.
- Search is a decorative affordance only (not wired to real search).
- Transaction history, charts, streaks, or spend trends.

### Success Metric
Side-by-side, all three screens are visually indistinguishable from the design source at 375px (sample-data parity), and the app runs on real data without layout breakage.

### Component Ownership
- UI rebuild of all three screens — `@ui` (`skills/ui-cardmaxxer.md`), with `@designer` for the category-mapping and token-reconciliation decisions.
- `Card.annualFee` schema + scrape/parse extraction — `@cto` (architecture) → `@data` / `@llm-parser`, tasked in `@create-plan`.
- Review-gate confidence surfacing — `@llm-parser`.

---

## Feature 10: Usage Accuracy & In-Place Logging

### Problem Statement
The app tells the user how much a benefit is worth but misrepresents *when* and *how much* can actually be used in a given reset window, and only lets usage be logged on the Cards screen — not on the Overview where the user naturally notices the gap. A "$600/yr, split semiannually" credit displays a single $600 window, implying the user can extract $600 at once when the real per-window cap is $300. Combined with no days-until-reset visibility per benefit and no logging at the point of attention, the app is not usable for real daily tracking.

### User Story
As the single user, I want each benefit to reflect what I can actually use in its current reset window, see how many days are left on every benefit, and log usage from wherever I'm looking — so the numbers are trustworthy and tracking isn't clunky.

### Sub-features

#### 10.1 — Per-window benefit cap *(data correctness — highest risk)*
**Business Logic**
- A benefit's `value` represents the amount usable in **one reset window**, not the annual/lifetime total. Monthly $50 → `value` = $50. "$600/yr, semiannual ($300 each half)" → `value` = $300 (resets to $300 each window). Annual benefit with no sub-split → `value` = the annual amount (the window *is* the year). `once` → the one-time amount.
- Usage controls and Overview/Cards totals cap at the per-window `value`. Auto-reset to 0 each window is existing period-engine behavior (lazy, read-time) — unchanged.
- Going forward, the scrape/LLM parse and review gate must capture the **per-window** figure. The review gate is the safety net: the user confirms/corrects the per-window amount before any save.
- **Existing data:** all current benefits are audited for yearly-vs-per-window mis-statements; the user is presented a list of suspected mis-stated benefits and confirms corrections, applied via the normal benefit-edit path. **No destructive re-scrape** (re-scrape risks the LLM repeating the error and wipes manual edits).

**Acceptance Criteria**
- [ ] Given a "$600/yr semiannual" benefit, when stored and displayed, then `value` = $300 and the usage control caps at $300; the next window resets to a fresh $300.
- [ ] Given an annual benefit with no sub-split, then `value` = the annual amount (no change in behavior).
- [ ] Given the parse + review gate, then the per-window amount is what is presented for confirmation.
- [ ] Existing mis-stated benefits are surfaced to the user for confirmation and corrected without a destructive re-scrape.

**Edge Cases**
- Benefit advertised only as an annual total with no stated per-window split → treat the reset window as the year (`value` = annual amount); user can correct in the review gate.
- `once` benefit → `value` = one-time amount, no window reset.

#### 10.2 — Days-left on every Overview benefit row
**Business Logic**
- Every tracked benefit row on Overview displays days until its current window ends ("Xd left"), not only when within the urgent (≤14 day) threshold.

**Acceptance Criteria**
- [ ] Given a tracked benefit with an open period, when Overview loads, then its row shows the whole days remaining until `periodEnd`.
- [ ] Given a `once` or set-and-forget (activation, no period) benefit, then no days-left value is shown (not "0d").

#### 10.3 — Inline usage logging from Overview
**User Flow**
1. User taps a benefit row on Overview.
2. The row expands inline to reveal the type-appropriate control (slider for credit/perk, toggle for subscription, counter for access).
3. User logs usage; the change persists via the existing `updateBenefitUsage()` path; the money-at-risk hero and category totals recompute live.
4. Tapping the row again (or another row) collapses it.

**Business Logic**
- Controls are **hidden until the row is tapped** (always-on controls are too clunky). One row expanded at a time.
- Reuses the existing Cards usage controls and the single write path — no new usage-write mechanism.

**Acceptance Criteria**
- [ ] Given a collapsed Overview benefit row, when tapped, then the correct usage control for its type appears inline.
- [ ] Given usage logged on Overview, then it persists via `updateBenefitUsage()` and the hero + totals update without a full reload.
- [ ] Given one row expanded, when another is tapped, then the first collapses (one open at a time).

#### 10.4 — Cards expanded view: visible/hidden split
**Business Logic**
- The expanded card detail lists **only visible (tracked) benefits**. Hidden (untracked) benefits collapse into a single row at the bottom labeled "N hidden — tap to expand"; tapping reveals them (with their eye toggles).
- The existing eye icon moves a benefit between sections: hiding a visible benefit drops it into the hidden section and removes it from Overview totals; showing a hidden benefit moves it up and rejoins Overview totals.
- This brings the eye/tracked toggle officially **in scope** (Feature 6 listed it as out-of-scope/post-MVP; this reconciles that drift).

**Acceptance Criteria**
- [ ] Given a card with tracked and untracked benefits, when the card is expanded, then only tracked benefits show in the main list and untracked ones are collapsed into a single "N hidden" row.
- [ ] Given the hidden row, when tapped, then untracked benefits expand with their eye toggles.
- [ ] Given the eye toggle, when a visible benefit is hidden, then it moves to the hidden section and leaves Overview totals; when a hidden one is shown, the reverse.
- [ ] Given all benefits visible, then the hidden row is omitted (not "0 hidden").

### Out of Scope (Feature 10)
- Transaction auto-matching or import.
- Multi-period forecasting / projecting future windows.
- Push or email notifications for resets.
- Usage history reports across past windows.

### Success Metric
The user can log a full month of real card usage end-to-end — on whichever screen they're looking at — with per-window amounts correct, days-left visible per benefit, and no clunky always-on controls.

### Component Ownership
- Per-window `value` semantics in scrape/parse + review gate — `@cto` (data model) → `@llm-parser` / `@data`.
- Existing-data audit + guided correction — `@data`.
- Overview days-left + inline logging, Cards visible/hidden split — `@ui` (`skills/ui-cardmaxxer.md`).

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
