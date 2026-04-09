# Design Decisions

## Visual Direction
**Type:** Consumer personal finance
**Feeling:** Calm command center — you open it, you immediately know where you stand. Nothing fights for attention. Expressive animations reward interaction without being distracting.
**Reference products:** Apple Wallet (card stack interaction), Curve (card color identity), Revolut (expressive polish)

## Audience
**Primary user:** Swarnim — 10 credit cards, personal finance power user, checks weekly
**Platform priority:** Mobile-first. Desktop must work but mobile is the primary design target.
**Use frequency:** Weekly — animations and transitions should feel satisfying, not annoying on repeat use

## Three Spaces

### 1. Overview
Aggregated view of `$Credits` and `One-time Perks` only — grouped by category across all cards.
- Shows total available vs total used per category (e.g. "$700 travel credit across 3 cards")
- Highlights expiring soon (amber) — benefits resetting within 7 days with unused value
- Subscriptions and Access do NOT appear here — they belong in the card-level view only
- Color: calm, mostly neutral with amber accents for urgency. Card brand colors used sparingly.

### 2. Cards (Card Stack)
Apple Wallet-style scrollable card stack:
- Cards stacked vertically with slight vertical offset — each card peeks above/below
- **Scroll-driven scale:** card closest to center = full scale (1.0) + full opacity. Cards above/below = reduced scale (~0.92) + reduced opacity (~0.75). Creates dynamic depth as you scroll.
- **Scroll snap:** snaps to each card — user always lands on a card, never between two
- Tap focused card → card lifts and expands, benefits slide up beneath it in a compact scrollable list
- Benefits are grouped within each card: `$Credits` → `Subscriptions` → `Access` → `One-time Perks`
- Tap the card again (or back gesture) → benefits fold back, card settles into stack

### 3. Admin
Central management space — add/edit/remove cards and benefits, trigger re-scrapes, review parsed benefits before saving.
- Functional over beautiful — forms, lists, toggles
- Same dark background and typography as the rest of the app
- Less animation — actions are deliberate here, not playful

## Color Direction
**Background:** Deep dark, near-black with a slight warm tint (not cold blue-black). Hex direction: ~`#0F0E0D` range.
**Card colors:** Each card gets an issuer-matched color identity, auto-assigned, user-overridable.

| Issuer | Direction |
|---|---|
| Amex | Gold / champagne |
| Chase | Sapphire blue |
| Capital One | Deep red |
| Citi | Royal blue |
| Discover | Bright orange |
| Custom / other | Slate grey (neutral fallback) |

**Slider fill:** Uses the active card's color — so Amex credit fills gold, Chase fills blue.

| State | Color |
|---|---|
| Expiring soon | Amber — `#F59E0B` direction |
| Fully used / complete | Soft green — muted, not neon |
| Unused / unclaimed | Desaturated, low contrast — not alarming |
| Primary text | Near-white |
| Secondary text / labels | Mid-grey |

## Typography
- **Font:** Clean, modern sans-serif — Inter or equivalent system font
- **Numbers are the headline** — amounts (`$247 / $300`) are large and prominent; labels are secondary
- **Weight:** Medium (500) for body, Semi-bold (600) for amounts, Regular (400) for labels
- **Tracking:** Tight on labels, normal on amounts

## Tracking UI per Benefit Type
| Type | UI Component |
|---|---|
| `$Credit` | Slider (spring physics) + manual number input. Fill uses card color. |
| `One-time Perk` | Same as `$Credit` — slider + input |
| `Subscription` | Toggle — click-snap animation, color fills when activated |
| `Access` | +/- Counter — number rolls with slot-machine effect |

## Interaction Principles
**Motion:** Expressive — noticeable, spring-physics-driven, never jarring
**Density:** Moderate — breathing room on the card stack, compact within expanded card benefits
**Feedback:** Inline — sliders update live, completions pulse, no disruptive toasts for tracking actions

## Animation Spec

| Interaction | Animation | Timing |
|---|---|---|
| Scroll through card stack | Scale + opacity driven by scroll position via `useScroll` + `useTransform` | Continuous, tied to scroll |
| Card snap to center | Scroll snap + spring settle | ~200ms spring |
| Tap card to expand | Card lifts (scale + shadow increase), benefits slide up | ~300ms spring |
| Tap card to collapse | Benefits fold back, card returns to stack position | ~250ms spring |
| Slider drag | Spring resistance, live number update | Continuous |
| Mark benefit full | Fill sweeps, soft color pulse on completion | ~400ms |
| Toggle subscription on | Snap to active, color fills in | ~150ms |
| Counter increment | Number rolls up/down (slot machine) | ~120ms |
| Expiring soon badge | Slow amber pulse, repeating | 2s loop, subtle |

## Component Approach
**Primary library:** shadcn/ui — accessible primitives, customizable enough for this design direction
**Animation library:** Framer Motion — scroll-driven scale, spring physics, layout animations, gesture handling. Required for the card stack interaction.
**Slider:** Radix UI Slider (via shadcn) with custom dark styling and card-color fill
**Icons:** Lucide React (already in shadcn ecosystem)

## What to Avoid
- **Light mode as default** — washes out card colors, feels like a bank app
- **Flat, instant transitions** — kills the premium feel
- **Tables or grids for benefit lists** — too clinical. Use card-style rows with breathing room
- **Red for UI states** — red reads as error/danger. Reserve it only for CapOne card branding
- **Too many colors in Overview** — overview is calm. Card colors used sparingly; lean on neutral + amber accents
- **Toasts for tracking updates** — inline feedback only. Sliders and toggles confirm themselves visually.
- **Fan/spread card layout (Curve-style)** — too busy. Apple Wallet's linear stack is calmer and more focused.

## Open Questions for @cto
None — Framer Motion with Next.js App Router is supported via client components (`"use client"`). No technical blockers identified.
