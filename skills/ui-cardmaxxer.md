# Skill: @ui (CardMaxxer)

> Project-specific UI skill for CardMaxxer. **Overrides the global `skills/ui.md` for this project.**
> Always read `docs/design-decisions.md` before any UI work — it is the source of truth.
> This skill does not make design decisions — it applies them exactly.

---

## Purpose
Builds UI components for CardMaxxer: dark-background personal finance dashboard with Apple Wallet-style card stack, Framer Motion spring animations, and consumer-grade polish. Mobile-first throughout.

---

## Active Mode
`@ui consumer` — with CardMaxxer-specific overrides defined below.

---

## Pre-conditions

1. Read `manifest.md` — confirm Playwright MCP is available for visual verification
2. Read `docs/design-decisions.md` — confirm design direction before building
3. Confirm Next.js + Tailwind + shadcn/ui + Framer Motion are installed
4. Read task spec from `docs/plan.md` — understand exactly what to build

---

## Platform Constraints

**Mobile-first.** Design at 375px, adapt up to desktop.

- Minimum touch target: 48px height/width on all interactive elements
- No hover-only interactions — every hover state must have a touch equivalent
- Test at 375px viewport before considering desktop done
- Framer Motion animations must respect `prefers-reduced-motion` — wrap with `useReducedMotion()`

---

## Component Libraries

| Element | Library | Notes |
|---|---|---|
| Base components | shadcn/ui | All forms, dialogs, inputs, navigation |
| Card stack + all animations | Framer Motion | Scroll-driven scale, spring physics, layout animations, AnimatePresence |
| Slider (credit tracking) | Radix UI Slider (via shadcn) | Custom dark styling, card-color fill override |
| Success / completion states | Magic UI | Soft pulse on benefit completion, celebrate fully-used benefit |
| Icons | Lucide React | Already in shadcn ecosystem — no other icon library |
| Typography | Inter (system font stack) | No external font import needed |

---

## Design Constants

Apply these values consistently. Do not introduce new colors or spacing without checking `docs/design-decisions.md`.

```typescript
// Backgrounds
const BG_PRIMARY = '#0F0E0D'       // main app background — near-black, warm tint
const BG_SURFACE = '#1A1917'       // card surfaces, list rows
const BG_ELEVATED = '#252321'      // modals, dropdowns

// Card issuer colors — auto-assigned, user-overridable
const CARD_COLORS: Record<string, string> = {
  amex:        '#C9A84C',  // gold / champagne
  chase:       '#117ACA',  // sapphire blue
  capital_one: '#C03A2B',  // deep red
  citi:        '#1B3F8B',  // royal blue
  discover:    '#E87722',  // bright orange
  other:       '#6B7280',  // slate grey fallback
}

// State colors
const COLOR_EXPIRING  = '#F59E0B'  // amber — benefits resetting within 7 days
const COLOR_COMPLETE  = '#4ADE80'  // soft green — benefit fully used
const COLOR_INACTIVE  = '#374151'  // desaturated — unclaimed / not activated

// Text
const TEXT_PRIMARY    = '#F9F9F8'  // near-white
const TEXT_SECONDARY  = '#9CA3AF'  // mid-grey — labels, metadata
const TEXT_CAPTION    = '#6B7280'  // section headers, captions

// Typography scale
// Amount displays:   text-3xl font-semibold tracking-tight
// Benefit names:     text-base font-medium
// Labels / metadata: text-sm font-normal text-secondary
// Section headers:   text-xs font-medium uppercase tracking-wider text-caption
```

---

## Three Spaces — Component Breakdown

### 1. Overview Space

> Redesigned 2026-05-16 (Tasks 36–38, urgency-primary). Supersedes the prior
> category-aggregation spec. See PRD Feature 6 + FB13. Cards/Admin unchanged.

**Purpose:** Triage by urgency — "what am I about to lose, and what do I do today?"

- Layout: money-at-risk hero → 3 urgency sections, NOT category cards
- Hero (`MoneyAtRiskHero`): 56px semibold tabular total, Framer Motion count-up, amber pulse; calm/positive copy when nothing at risk
- Sections (`UrgencySection`): **Needs attention** (amber, expiring soon, soonest-first) → **On track** (green) → **Done** (muted, collapsed by default)
- Rows (`OverviewBenefitRow`): benefit type/category/source-card are row-level **metadata only**, never the grouping axis
- All tracked types appear (credit/subscription/access/perk) — type is not a filter
- Only `tracked: true`; `tracked: false` never appears anywhere on Overview
- Palette: artifact tokens in `src/components/overview/tokens.ts` (warm `#0F0E0D`, amber `#F59E0B` single accent, hairline cards). Do not hardcode — import `OV`.
- Empty state (no tracked benefits): guide to add/scrape a card in Admin — no scary zeros

### 2. Cards Space (Apple Wallet Stack)

**The core interaction. Implement exactly as specified.**

```
Stack behavior:
- Container: full viewport height, overflow-y scroll, scroll-snap-type: y mandatory
- Each card slot: height ~220px, scroll-snap-align: center, scroll-snap-stop: always
- Cards peek above and below to signal scrollability

Scale + opacity (Framer Motion):
- Use useScroll() on the container ref
- For each card, use useTransform() to map scroll position to scale + opacity
- Center card (in snap position): scale(1.0), opacity(1.0)
- Cards 1 position away: scale(0.92), opacity(0.75)
- Cards 2+ positions away: scale(0.85), opacity(0.5)
- Interpolation is continuous — not step-based

Expand interaction:
- Each card has a layoutId (e.g., `card-[id]`)
- Tap focused card → Framer Motion layout animation expands card to fill space
- Benefits list: AnimatePresence → slides up beneath expanded card (y: 40 → 0, opacity: 0 → 1)
- Expanded state: card stays visible at top, scrollable benefits list below

Collapse:
- Tap the card header in expanded state → reverse layout animation
- AnimatePresence exit on benefits list (y: 0 → 40, opacity: 1 → 0)
- Card returns to stack position via layoutId reverse
```

Benefits list within expanded card:
- Grouped by type: `$Credits` → `Subscriptions` → `Access` → `One-time Perks`
- Section headers: `text-xs uppercase tracking-wider`
- Each benefit row: name + tracking UI + reset label (compact)
- Scrollable independently of the card stack

### 3. Admin Space

**Functional over beautiful — same dark theme, minimal animation.**

- Add card flow: issuer dropdown → card name input → "Scrape Benefits" trigger
- Scraping state: loading indicator with "Scraping [Card Name]..." message
- Review gate: parsed benefits list, each row editable, confidence color-coded
- Confirm & Save button: only enabled when user has reviewed all flagged benefits
- Benefit list per card: sortable by type, edit/delete inline
- Re-scrape button per card: shows `lastScrapedAt` timestamp

---

## Tracking UI Components

### `$Credit` + `One-time Perk` — Slider

```
████████░░  $247 / $300
[──────────●──────] ← draggable, spring physics
            or
          [ 247 ] ← manual input, synced with slider

[Mark Full]  ← shortcut button, fills to allocatedValue
```

- Slider fill color = card's issuer color (`CARD_COLORS[issuer]`)
- On drag: live update to number display, spring resistance on thumb
- On release: call `updateBenefitUsage()`, animate fill to new position
- On "Mark Full": animate fill sweep + green pulse completion state

### `Subscription` — Toggle

```
● DashPass DoorDash    [activated ✓]   ← green fill
○ Peloton Credit       [not claimed]   ← muted
```

- Toggle: spring snap — `stiffness: 500, damping: 30`
- On activate: color fills in, icon transitions
- On deactivate: color drains out

### `Access` — Counter

```
Priority Pass Lounge
[−]  3  [+]   of unlimited
```

- Number change: slot machine roll — `AnimatePresence`, exit `y: -20`, enter `y: 20`
- Buttons: 48px minimum touch target

---

## Animation Spec

| Interaction | Framer Motion Implementation | Timing |
|---|---|---|
| Card stack scroll | `useScroll` + `useTransform` → scale + opacity per card | Continuous / scroll-driven |
| Card snap to center | CSS `scroll-snap` + spring settle | ~200ms spring |
| Card expand | `layoutId` match + `AnimatePresence` for benefits | ~300ms spring |
| Card collapse | `layoutId` reverse + `AnimatePresence` exit | ~250ms spring |
| Slider drag | Radix slider + spring on thumb position | Continuous |
| Benefit mark full | Fill sweep + `scale: [1, 1.05, 1]` + green pulse | ~400ms |
| Toggle activate | Spring snap + color fill | `stiffness: 500, damping: 30` |
| Counter change | `AnimatePresence` y-axis roll | ~120ms |
| Expiring badge | Slow amber pulse loop | 2s repeat, `opacity: [0.6, 1, 0.6]` |

**Reduced motion:** Wrap all animations with `useReducedMotion()`. If true: disable scale/opacity transitions, keep layout shifts only.

---

## Visual Verification

Playwright MCP is configured for this project (`manifest.md`).

After building any component:
1. Navigate to the component at 375px viewport
2. Take screenshot
3. Compare against `docs/design-decisions.md` — check: background color, card colors, typography scale, animation behavior description
4. Fix mismatches before reporting done
5. Take a second screenshot at 1280px desktop viewport — confirm it doesn't break

---

## Process

1. Read the task spec from `docs/plan.md`
2. Confirm which space it belongs to (Overview / Cards / Admin) and apply that space's rules
3. Build the component using the libraries and constants above
4. Present code to builder for review — do not write to disk without approval
5. After approval: write file, take screenshots at 375px and 1280px, verify against design direction
6. Report: "Built [component]. [Mobile screenshot matches / gap: X fixed]. [Desktop: ok / gap: Y fixed]."

---

## Closing

"Built [component name] — CardMaxxer consumer mode, mobile-first (375px verified), desktop (1280px verified). Animation: [implemented / skipped — reduced motion]. Design direction: [matches / gaps fixed: list]."
