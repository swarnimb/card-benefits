"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLORS, RADII } from "@/lib/ui/tokens";
import { FlowShell } from "./flow-shell";
import { ScanCardVisual } from "./scan-card-visual";
import { CheckIcon, RescrapeIcon } from "./icons";

const SCAN_STEPS = [
  "Connecting to issuer",
  "Reading the benefits guide",
  "Extracting credits with AI",
  "Checking amounts & reset dates",
];

/** Props for Scanning. */
export interface ScanningProps {
  cardName: string;
  color: string;
  /** True while the real POST .../scrape is in flight. */
  pending: boolean;
  /** A scrape/parse error surfaced by the real call (not a fake failure). */
  errorMessage?: string | null;
  /** Called once the real result has arrived and the animation has settled. */
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Animated scan view (design source `Scanning`) driven by the REAL async scrape
 * (honesty rule): the stepped progress + card sweep animate while `pending` is
 * true. The first steps advance on a short timer, but the FINAL step is held in
 * its working state until the real call resolves — only then does it complete
 * and fire `onDone`. A surfaced scrape/parse error short-circuits to a visible
 * error state instead of faking success. Framer Motion, gated on reduced motion.
 */
export function Scanning({ cardName, color, pending, errorMessage, onDone, onCancel }: ScanningProps) {
  const reduceMotion = useReducedMotion();
  // step is the index of the currently-active step (0..len). When the real call
  // is done AND step has reached the last index, we mark complete.
  const [step, setStep] = useState(0);
  const doneFiredRef = useRef(false);

  // Advance the early steps on a timer to give honest, non-instant feedback.
  // We stop one short of the last step; the last step waits on the real call.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < SCAN_STEPS.length - 1; i++) {
      timers.push(setTimeout(() => setStep((s) => Math.max(s, i + 1)), 600 * (i + 1)));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  // When the real scrape finishes (pending false), advance to review. On a clean
  // result the final step completes first; on a scrape/parse error we show the
  // error briefly (no fake success) THEN open review — which surfaces the error
  // and offers manual entry (preserving the existing degraded-path behavior).
  useEffect(() => {
    if (pending || doneFiredRef.current) return;
    if (!errorMessage) setStep(SCAN_STEPS.length);
    const t = setTimeout(
      () => {
        if (doneFiredRef.current) return;
        doneFiredRef.current = true;
        onDone();
      },
      errorMessage ? 1100 : 520,
    );
    return () => clearTimeout(t);
  }, [pending, errorMessage, onDone]);

  const pct = Math.min(100, (step / SCAN_STEPS.length) * 100);
  const complete = step >= SCAN_STEPS.length;

  return (
    <FlowShell
      title="Scanning benefits"
      subtitle={cardName}
      onClose={onCancel}
      closeLabel="Cancel"
    >
      <ScanCardVisual cardName={cardName} color={color} pending={pending} pct={pct} />

      {/* steps */}
      <div style={{ padding: "22px 28px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        {SCAN_STEPS.map((s, idx) => {
          const done = step > idx;
          const active = step === idx;
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                opacity: done || active ? 1 : 0.4,
                transition: "opacity 300ms ease",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: RADII.pill,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? COLORS.greenDim : "rgba(255,255,255,0.05)",
                  border: `1px solid ${done ? COLORS.greenBorder : COLORS.hairline2}`,
                  color: COLORS.green,
                }}
              >
                {done ? (
                  <CheckIcon s={10} />
                ) : active ? (
                  <motion.span
                    style={{ display: "inline-flex", color: COLORS.amber }}
                    animate={reduceMotion ? undefined : { rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  >
                    {RescrapeIcon}
                  </motion.span>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 13.5,
                  color: done ? COLORS.text2 : active ? COLORS.text : COLORS.text3,
                  letterSpacing: -0.1,
                }}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>

      {errorMessage ? (
        <div style={{ padding: "22px 28px 0", textAlign: "center" }} role="alert">
          <div style={{ fontSize: 13, color: COLORS.amber, lineHeight: 1.5 }}>{errorMessage}</div>
          <div style={{ fontSize: 12, color: COLORS.text3, marginTop: 6 }}>
            Opening review so you can add benefits manually…
          </div>
        </div>
      ) : (
        complete && (
          <div style={{ padding: "22px 28px 0", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: COLORS.text2 }}>Opening review…</div>
          </div>
        )
      )}
    </FlowShell>
  );
}
