"use client";

import { motion, useReducedMotion } from "framer-motion";
import { OV, OV_SPRING } from "./tokens";

interface ProgressProps {
  used: number;
  /** Dollar cap; null = unlimited (renders a full, calm bar). */
  amt: number | null;
  color?: string;
  track?: string;
  height?: number;
}

/**
 * Restrained linear progress bar. Real Framer Motion width animation
 * (0 → pct%), replacing the design source's CSS width transition.
 * Reduced-motion: renders the final width immediately. Unlimited credits
 * (amt === null) show a full bar rather than dividing by null.
 */
export function Progress({
  used,
  amt,
  color = OV.green,
  track = "rgba(255,255,255,0.06)",
  height = 3,
}: ProgressProps) {
  const reduceMotion = useReducedMotion();
  const pct =
    amt === null ? 100 : amt === 0 ? 0 : Math.min(100, (used / amt) * 100);

  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: track }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduceMotion ? { duration: 0 } : OV_SPRING}
      />
    </div>
  );
}
