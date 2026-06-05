"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import { cardGradient } from "@/components/cards/card-gradient";
import { FlowShell } from "./flow-shell";
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
                  border: `1px solid ${done ? "rgba(134,239,172,0.4)" : COLORS.hairline2}`,
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
