/**
 * Canonical CardMaxxer design tokens — the single source of truth for the
 * Feature 9 three-screen redesign. Every value is lifted verbatim from the
 * approved design export (decompressed JSX in the gitignored
 * `docs/design-source/`): COLORS + RADII + SHADOWS + TYPE + EASING are exact
 * design-source values; SPRING is the project's Framer Motion translation of
 * the design's overshoot easing (the export is CSS-transition based, the app
 * is Framer Motion based — see SPRING note).
 *
 * Import from here everywhere. `src/components/overview/tokens.ts` re-exports
 * these so the old `OV.*` palette and the `@ui-cardmaxxer` skill palette no
 * longer diverge (Task 56). Do not hardcode hex/px in components.
 */

/**
 * Core palette — verbatim from the design source's `T` token block
 * (`docs/design-source/Overview.jsx`). Warm near-black canvas, amber as the
 * single urgency accent, soft green for completion, hairline borders.
 */
export const COLORS = {
  bg: "#0F0E0D",
  surface: "#191715",
  surface2: "#211E1B",
  hairline: "rgba(255,255,255,0.055)",
  hairline2: "rgba(255,255,255,0.09)",
  text: "#F5F1EA",
  text2: "#B6AFA4",
  text3: "#7C766D",
  text4: "#4E4944",
  amber: "#F59E0B",
  amberSoft: "rgba(245,158,11,0.14)",
  green: "#86EFAC",
  greenDim: "rgba(134,239,172,0.18)",
} as const;

/**
 * Per-issuer color identity. `color` (card fill) and `dot` (issuer marker) are
 * verbatim from the design source — the bank-level values shared across that
 * issuer's cards. `tint` (chip background) comes from the primary card's tint
 * in `docs/design-source/data.js`. Discover lives only in the Admin add-card
 * catalog (`docs/design-source/Admin.jsx`), which defines color + dot but no
 * tint; its tint follows the source's 0.14-alpha convention.
 */
export const ISSUER = {
  amex: { color: "#C9A961", dot: "#D4B97A", tint: "rgba(201,169,97,0.14)" },
  chase: { color: "#3B5BDB", dot: "#5E7BE8", tint: "rgba(59,91,219,0.16)" },
  capitalone: { color: "#B73A3A", dot: "#D85959", tint: "rgba(183,58,58,0.16)" },
  citi: { color: "#2E5BC9", dot: "#557DDE", tint: "rgba(46,91,201,0.14)" },
  // tint derived (0.14 convention) — Admin catalog defines only color + dot.
  discover: { color: "#E0741F", dot: "#E89149", tint: "rgba(224,116,31,0.14)" },
} as const;

/**
 * Border radii (px) used across the app surfaces. The iOS-device-frame radii
 * from the design export's mock shell (`IOSDevice.jsx`: 48/27/24) are the
 * preview chrome, not app UI, and are intentionally excluded.
 */
export const RADII = {
  pill: 99, // issuer dots, progress bars, nav pill
  card: 16, // primary surface cards (rows, summary, category)
  cardLg: 18, // credit-card visual
  button: 14,
  control: 13, // search bar, toast, info box
  input: 10,
  chip: 8,
  icon: 7, // icon containers, checkboxes
} as const;

/** Box-shadows — verbatim from the design source. */
export const SHADOWS = {
  card:
    "0 22px 44px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.14) inset, 0 1px 0 rgba(0,0,0,0.4)",
  cardPeek: "0 -1px 0 rgba(255,255,255,0.10) inset, 0 -8px 18px rgba(0,0,0,0.5)",
  elevated: "0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
  toast: "0 12px 30px rgba(0,0,0,0.5)",
  miniCard: "0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
} as const;

/**
 * Type ramp — `fontSize`/`letterSpacing` in px, `fontWeight` numeric, verbatim
 * from the design source's inline styles. Spread directly into inline styles.
 */
export const TYPE = {
  hero: { fontSize: 56, fontWeight: 600, letterSpacing: -2.2 },
  stat: { fontSize: 22, fontWeight: 600, letterSpacing: -0.6 },
  title: { fontSize: 20, fontWeight: 600, letterSpacing: -0.5 },
  cardName: { fontSize: 19, fontWeight: 600, letterSpacing: -0.3 },
  body: { fontSize: 14.5, fontWeight: 500, letterSpacing: -0.15 },
  meta: { fontSize: 11, fontWeight: 500, letterSpacing: 0.2 },
  label: { fontSize: 11, fontWeight: 500, letterSpacing: 1.1 }, // uppercase section headers
  caption: { fontSize: 10, fontWeight: 500, letterSpacing: 1 }, // uppercase captions
} as const;

/**
 * Framer Motion spring tuned to the design's `cubic-bezier(0.34,1.2,0.64,1)`
 * overshoot. The design export animates with CSS transitions + that easing;
 * the app uses Framer Motion, so motion is expressed as this equivalent spring
 * (stiffness 420 / damping 26) plus the literal easing below for CSS/`tween`.
 */
export const SPRING = { type: "spring" as const, stiffness: 420, damping: 26 };

/** Dominant easing curve from the design source (overshoot). */
export const EASING = "cubic-bezier(0.34, 1.2, 0.64, 1)";

/** Softer modal-enter easing variant (design source one-off). */
export const EASING_MODAL = "cubic-bezier(0.34, 1.1, 0.64, 1)";
