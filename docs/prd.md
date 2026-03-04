# PRD: Card Benefits Tracker — MVP

## Problem Statement
Multi-card credit card holders lose value because checking benefits requires navigating each bank's app through multiple screens. Benefits expire unused, reward caps go untracked, and there's no single view across cards. The friction of checking outweighs the perceived value of optimizing.

## Target User
A person with 2+ credit cards who wants to see all benefits in one place and understand how much of each benefit they've used. Starting scope: personal use, portfolio project.

## User Story
As a multi-card holder, I want to see all my credit card benefits in one dashboard and track my usage against them, so that I stop leaving money on the table.

---

## Feature 1: First-Time Experience

### User Flow
1. User opens app for the first time
2. Walkthrough tutorial (3 screens max, skippable):
   - Screen 1: Value prop — "All your card benefits, one place"
   - Screen 2: What tracking looks like — mock dashboard preview
   - Screen 3: CTA — "Add your cards to get started"
3. Card selection screen:
   - Search bar to find cards by name or bank
   - Cards grouped by bank
   - Multi-select — user picks all cards they hold
   - Clear indicator of how many cards are in the database ("Showing 10 of 10 available cards — more coming soon")
4. For each selected card, prompt user to optionally enter current reward points/miles balance
5. User lands on dashboard with selected cards

### Business Logic
- Tutorial shown only on first visit (flag in local storage or DB)
- Card selection requires at least 1 card to proceed
- Selected cards saved to user profile
- Points balance entry is optional — can be skipped and entered later

### Acceptance Criteria
- [ ] Given a first-time user, when they open the app, then they see the tutorial
- [ ] Given the tutorial, when user clicks skip, then they go directly to card selection
- [ ] Given card selection, when user searches, then results filter in real-time
- [ ] Given card selection, when user selects 1+ cards and confirms, then they see optional points balance entry
- [ ] Given points balance entry, when user skips, then they land on dashboard with no balance shown
- [ ] Given points balance entry, when user enters a value, then dashboard shows that as the starting balance

### Edge Cases
- No search results: Show "Card not found yet — we're adding more cards regularly"
- User tries to proceed with 0 cards: Disable continue button

### Out of Scope
- User accounts / authentication (local app, single user)
- Adding custom cards not in the database

---

## Feature 2: Card Benefits Dashboard

### User Flow
1. User sees their primary card with all benefits listed
2. Swipe left/right to switch between cards
3. Each card view shows:
   - Card name, bank, and card art/color
   - Balance and credit limit (secondary, smaller)
   - Recent transactions summary (secondary, collapsible)
   - **All benefits and rewards (primary, prominent):**
     - Trackable benefits: show utilization (e.g., "$340 / $1,500 dining cashback used")
     - Non-trackable benefits: show as available with description and link to merchant/bank if applicable
   - Points/miles balance: user-entered starting balance + estimated earnings from transactions
4. User can tap any benefit to open benefit detail modal

### Benefit Detail Modal
- Small modal overlay (not a full page)
- Shows: benefit description, utilization breakdown (which transactions matched), period dates, cap details
- If applicable: clickable link to bank rewards page or merchant page
- Not every benefit needs a link — only show when relevant (e.g., a dining cashback benefit doesn't need a link, but "DoorDash DashPass membership" links to DoorDash)
- Close via X button or tap outside

### Empty States
- **No CSV imported (per card):** Show all benefits without utilization data. Soft prompt: "Import transactions to track your progress"
- **No point balance entered:** Show "—" for points with a tap-to-add prompt
- **No transactions in current period:** Show 0% utilization with "No matching transactions yet this [period]"
- **Card just added, no data at all:** Show benefits list (the core value) with prompts for CSV import and points entry

### Business Logic
- Benefits displayed in two groups: "Tracked" (have utilization data) and "Available" (display-only)
- Utilization calculated as: matching transactions in current period / benefit cap
- Period resets handled per benefit (monthly, quarterly, annually)
- Points estimated from: transaction amount × earning rate per category
- Point balance = user-entered starting balance + sum of estimated points from all imported transactions after the entry date
- User can update their point balance at any time from the card view (acts as a re-sync)

### Acceptance Criteria
- [ ] Given a user with 3 cards, when on dashboard, then they can swipe between all 3
- [ ] Given a card with tracked benefits, when CSV has been imported, then utilization bars show accurate progress
- [ ] Given a card with non-trackable benefits, when displayed, then benefit shows as available with description
- [ ] Given a benefit with a quarterly cap, when a new quarter starts, then utilization resets to 0
- [ ] Given transactions in dining category, when card earns 3X on dining, then estimated points reflect the multiplier
- [ ] Given a benefit tapped, when modal opens, then it shows breakdown and applicable links
- [ ] Given no CSV imported for a card, when dashboard loads, then benefits display with empty state prompts
- [ ] Given a user-entered point balance of 50,000 and 2,000 estimated earned, when dashboard loads, then points show 52,000

### Edge Cases
- No CSV imported yet: Show benefits without utilization, prompt to upload CSV for tracking
- Benefit period just reset: Show "Resets [date]" and 0% utilization
- Transaction doesn't match any benefit category: Counted toward base rate only
- User re-syncs point balance: New balance replaces old, future estimates calculate from new baseline + new entry date

### Out of Scope
- Real-time bank data sync
- Push notifications for expiring benefits
- Comparing benefits across cards

---

## Feature 3: CSV Transaction Import

### Shared Data Source
This app shares CSV source files with the Personal Finance Assistant (PFA) project. User downloads bank CSVs once to a designated folder (configurable in settings, e.g., `~/Finance/imports/`). Both apps import from that same folder independently — no shared code or database, just the same files on disk.

### User Flow
1. User taps "Import" in bottom nav
2. App shows files from the default import directory (if configured), or user browses/uploads manually
3. Selects which card the CSV is for
4. App auto-detects bank format and parses
5. Shows preview: "Found 47 transactions from Jan 1 - Jan 31" with duplicate warning if applicable
6. User confirms import
7. Dashboard updates with utilization data for that card

### Business Logic
- CSV parser supports formats for all major US banks. Each bank has a consistent CSV format across its cards. Supported banks for MVP:
  - Chase (date, description, category, type, amount)
  - American Express (date, description, amount, extended details, category)
  - Capital One (transaction date, posted date, card no., description, category, debit, credit)
  - Citi (status, date, description, debit, credit)
  - Bank of America (date, description, amount, running balance)
  - Discover (trans date, post date, description, amount, category)
  - Wells Fargo (date, amount, description)
- Bank format auto-detected from CSV column headers
- Transactions matched to benefit categories using: bank-provided category (if present) + LLM-based categorization of merchant names as fallback
- Duplicate detection: same date + amount + merchant = likely duplicate, warn user
- Imported transactions stored in DB, not re-processed on every view
- Multiple imports accumulate (user can upload monthly)

### Acceptance Criteria
- [ ] Given a CSV from any supported bank, when uploaded, then bank format is auto-detected and transactions are correctly parsed
- [ ] Given a transaction "UBER EATS $34.50", when no bank category provided, then LLM categorizes it as "dining"
- [ ] Given a previously imported transaction, when same CSV re-uploaded, then duplicates are flagged
- [ ] Given a successful import, when user returns to dashboard, then utilization reflects imported data
- [ ] Given an invalid/empty CSV, when uploaded, then user sees clear error message
- [ ] Given a CSV from an unsupported bank, when uploaded, then user sees "This bank format isn't supported yet" with list of supported banks

### Edge Cases
- CSV format doesn't match any known bank: Show "This bank format isn't supported yet. Supported banks: [list]"
- CSV has transactions for wrong date range: Import anyway, utilization calculates per period automatically
- Merchant name ambiguous (e.g., "AMAZON" could be shopping or groceries): Default to most common category, allow user override in future
- CSV contains both credits and debits: Parse both — credits may represent benefit reimbursements (e.g., travel credit)

### Out of Scope
- Automatic CSV fetching from email
- Real-time transaction import (Plaid)
- Reward points CSV import (points are calculated, not imported)

---

## Feature 4: Card Benefits Database

### User Flow
This is not user-facing directly — it powers Features 1-3.

### Business Logic
- Each card in DB has: bank name, card name, annual fee, card type
- Each benefit has: category, type (cashback/points/credit/perk), rate, cap amount, cap period (monthly/quarterly/annual), reset logic, description
- Benefits are one of two tracking types:
  - **Trackable:** Has a rate + category that can be matched against transactions (e.g., "5% on dining up to $1,500/quarter")
  - **Display-only:** Cannot be derived from transactions (e.g., "Airport lounge access", "Purchase protection"). Shown as available with description and optional external link.
- MVP: 5-10 popular cards, manually curated with LLM-assisted parsing from public bank webpages
- Card data is versioned — when benefits change, old data preserved for historical accuracy

### Acceptance Criteria
- [ ] Given a card in the database, when queried, then all benefits returned with complete structured data
- [ ] Given a trackable benefit, when it has category + rate + cap, then it can be matched against transactions
- [ ] Given a display-only benefit, when it has description + optional link, then it renders on dashboard

### Edge Cases
- Bank changes benefit terms mid-quarter: New version applies from effective date, old transactions use old rules
- Card has a benefit with no cap (e.g., "1X on everything"): Cap stored as null, utilization shown as total earned (no progress bar)

### Out of Scope
- User-submitted card data
- Automated scraping pipeline that runs on schedule
- Cards from non-US banks

---

## Feature 5: Card Management

### User Flow
1. User taps "Settings" in bottom nav
2. Sees list of their currently added cards
3. Can add new cards (same search + select flow as onboarding)
4. Can remove a card (with confirmation: "Remove [card name]? This will delete all imported transactions for this card.")
5. Can tap a card to edit: update point balance, view import history

### Business Logic
- Adding a card: same flow as onboarding card selection, filtered to cards not already added
- Removing a card: deletes the user-card association AND all imported transactions for that card
- Point balance: editable at any time, updates the baseline for future estimates

### Acceptance Criteria
- [ ] Given a user on settings, when they tap add card, then they see the card selection flow with already-added cards excluded
- [ ] Given a user removing a card, when they confirm, then the card and its transactions are deleted
- [ ] Given a user editing point balance, when they save, then dashboard reflects the new baseline immediately

### Edge Cases
- User removes their last card: Return to card selection flow (same as onboarding)
- User adds a card they previously removed: Starts fresh, no old transaction data restored

### Out of Scope
- Reordering cards on dashboard
- Card nicknames or custom labels

---

## Feature 6: Navigation

### Structure
Bottom navigation bar with 3 tabs:
- **Dashboard** (home icon) — card benefits dashboard, default view
- **Import** (upload icon) — CSV transaction import
- **Settings** (gear icon) — card management, data management

### Business Logic
- Active tab highlighted
- Dashboard is the default/home tab
- Navigation persists across all views (except modals and tutorial)
- Bottom nav should be an aesthetic, polished UI component — this is a portfolio piece

### Acceptance Criteria
- [ ] Given any screen, when user taps a nav tab, then they navigate to that section
- [ ] Given the current tab, when displayed, then it is visually highlighted
- [ ] Given the tutorial/onboarding flow, when active, then bottom nav is hidden

---

## Feature 7: Data Management

### User Flow
1. Accessible from Settings tab
2. Options:
   - **Clear transactions for a specific card** — removes imported CSV data for one card, keeps the card and benefits
   - **Clear all transactions** — removes all imported CSV data across all cards
   - **Reset point balance for a card** — clears the user-entered balance, resets to unknown
   - **Reset all data** — removes all cards, transactions, point balances. Returns to onboarding state.
3. Each destructive action requires confirmation dialog

### Acceptance Criteria
- [ ] Given clear transactions for a card, when confirmed, then only that card's transactions are deleted, benefits remain
- [ ] Given clear all transactions, when confirmed, then all transaction data is removed, cards and benefits remain
- [ ] Given reset all data, when confirmed, then app returns to first-time experience
- [ ] Given any destructive action, when initiated, then a confirmation dialog appears before execution

### Edge Cases
- Reset all while on dashboard: Redirect to tutorial/onboarding after reset completes

---

## MVP Scope Summary

**In:**
- 5-10 curated cards with structured benefits (covering 7 major US banks)
- Tutorial + card selection onboarding with optional points balance entry
- Swipeable dashboard with benefit utilization and empty states
- Benefit detail modal with applicable external links
- CSV import with auto-detected bank formats and transaction matching
- LLM-powered transaction categorization
- Points tracking: user-entered baseline + transaction-estimated earnings
- Display-only benefits with descriptions/links
- Bottom navigation (Dashboard, Import, Settings)
- Card management (add/remove cards, edit point balance)
- Data management (clear transactions, reset data)

**Out:**
- Plaid integration
- Card recommendation engine
- User accounts / auth
- Non-transaction benefit tracking (lounge visits)
- Automated scraping
- Push notifications
- Multi-user support

## Success Metric
- All benefits for selected cards visible and accurate
- CSV import correctly calculates utilization for trackable benefits
- First-time user can go from zero to full dashboard in under 3 minutes
- Portfolio-ready: clean UI, demonstrable data pipeline, clear architecture

---

## Change Log
| Date | Change | Reason |
|------|--------|--------|
| 2026-02-07 | Initial PRD created | MVP scoping from brainstorm session |
| 2026-02-07 | PRD gap review — 7 fixes | Added: card management, navigation, data management, benefit detail modal, empty states, points balance flow, CSV bank formats, data CRUD |
| 2026-02-07 | Shared data source with PFA | CSV files shared via configurable import directory — same files, independent apps, zero coupling |
