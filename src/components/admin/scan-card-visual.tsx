"use client";

import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import { cardGradient } from "@/components/cards/card-gradient";

/** Props for ScanCardVisual. */
export interface ScanCardVisualProps {
  cardName: string;
  color: string;
  /** True while the real scrape is in flight — drives the sweep animation. */
  pending: boolean;
  /** Progress percent (0–100) for the bar fill. */
  pct: number;
}

/**
 * The scanned-card visual for the scan view (extracted to keep `scanning` < 200
 * lines): the gradient card with the animated sweep line, plus the progress bar.
 * Gradient/overlay/sweep strings are design-source verbatim.
 */
export function ScanCardVisual({ cardName, color, pending, pct }: ScanCardVisualProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{
        padding: "24px 24px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* card being scanned with sweeping line */}
      <div
        style={{
          width: 220,
          height: 138,
          borderRadius: RADII.card,
          position: "relative",
          overflow: "hidden",
          background: cardGradient(color),
          boxShadow: "0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(130% 90% at -10% -10%, rgba(255,255,255,0.2), transparent 55%)",
          }}
        />
        <div style={{ position: "absolute", left: 16, top: 14, color: "#fff", fontSize: 14, fontWeight: 600 }}>
          {cardName}
        </div>
        {/* scan sweep — animated only while pending and motion is allowed */}
        {!reduceMotion && pending && (
          <motion.div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 28,
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
            }}
            initial={{ top: -28 }}
            animate={{ top: 138 }}
            transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 14,
            fontSize: 10,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          •••• •••• •••• ••••
        </div>
      </div>

      {/* progress bar */}
      <div
        style={{
          width: "100%",
          height: 3,
          borderRadius: RADII.pill,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
          marginTop: 28,
        }}
      >
        <motion.div
          style={{ height: "100%", borderRadius: RADII.pill, background: COLORS.amber }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: EASING }}
        />
      </div>
    </div>
  );
}
