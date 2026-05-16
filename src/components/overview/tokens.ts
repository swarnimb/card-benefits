/**
 * Overview-redesign design tokens — the approved design artifact's refined warm
 * palette. It converged on docs/design-decisions.md; centralized here so the
 * Overview components stay under the size limit and carry no magic colors (CQ-04).
 * Scoped to the Overview space only — the Cards/Admin spaces are unaffected.
 */
export const OV = {
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

/** Spring tuned to the artifact's cubic-bezier(0.34,1.2,0.64,1) overshoot feel. */
export const OV_SPRING = { type: "spring" as const, stiffness: 420, damping: 26 };

/** Money-hero count-up: ease-out over 0.9s (real Framer Motion `animate`, not rAF). */
export const OV_COUNT_UP = {
  duration: 0.9,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Days-until-reset at or below which a reset reads as urgent (amber). */
export const OV_URGENT_DAYS = 14;
