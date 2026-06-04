/**
 * Overview-space token re-exports. The palette and spring now come from the
 * canonical module (`src/lib/ui/tokens.ts`) so `OV.*` can no longer drift from
 * the design source (Task 56). Only the two Overview-specific behavioral
 * constants below are defined here — they are not design-source color/size
 * tokens, so they do not belong in the canonical palette.
 */
import { COLORS, SPRING } from "@/lib/ui/tokens";

/** Warm palette — alias of the canonical {@link COLORS}. */
export const OV = COLORS;

/** Framer spring — alias of the canonical {@link SPRING} (stiffness 420 / damping 26). */
export const OV_SPRING = SPRING;

/** Money-hero count-up: ease-out over 0.9s (real Framer Motion `animate`, not rAF). */
export const OV_COUNT_UP = {
  duration: 0.9,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/**
 * Framer Motion array form of the design source's overshoot easing
 * (`cubic-bezier(0.34, 1.2, 0.64, 1)` — see {@link EASING} in the canonical
 * tokens). Framer's `ease` takes a bezier array, not a CSS string, so the
 * literal CSS easing cannot be passed directly to `tween` transitions. Used for
 * one-off tween animations (sparkbar grow) where the {@link OV_SPRING} spring
 * is not a fit.
 */
export const OV_OVERSHOOT = [0.34, 1.2, 0.64, 1] as [number, number, number, number];

/** Days-until-reset at or below which a reset reads as urgent (amber). */
export const OV_URGENT_DAYS = 14;
