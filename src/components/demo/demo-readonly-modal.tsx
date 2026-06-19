"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { demoRepoUrl } from "@/lib/demo/demo-mode";
import { COLORS, EASING_MODAL_ARRAY, RADII, SHADOWS, TYPE } from "@/lib/ui/tokens";

/** Props for DemoReadonlyModal. */
export interface DemoReadonlyModalProps {
  /** Dismiss handler — wired to the backdrop, the close button, and Esc. */
  onClose: () => void;
}

/**
 * Centered "read-only demo" modal — the friendly replacement for the old bottom
 * toast (and for the negative "Failed to scrape"/inline-error states). Shown
 * whenever a demo visitor attempts a write that can't be saved. Positive framing,
 * not an error: explains the demo is fictional + read-only and offers a jump to
 * the source on GitHub. Dismissible via backdrop, the Got it button, or Esc.
 */
export function DemoReadonlyModal({ onClose }: DemoReadonlyModalProps) {
  const reduceMotion = useReducedMotion();

  // Esc to dismiss (keyboard parity with the backdrop click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-readonly-title"
      data-testid="demo-readonly-modal"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: COLORS.scrim, padding: 24 }}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.22, ease: EASING_MODAL_ARRAY }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          padding: "26px 24px 22px",
          borderRadius: RADII.card,
          background: COLORS.surface,
          border: `1px solid ${COLORS.hairline2}`,
          boxShadow: SHADOWS.elevated,
          textAlign: "center",
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.26, ease: EASING_MODAL_ARRAY }}
      >
        <span
          aria-hidden="true"
          className="inline-block size-2 rounded-full"
          style={{ background: COLORS.amber, marginBottom: 14 }}
        />
        <h2 id="demo-readonly-title" style={{ ...TYPE.title, color: COLORS.text, marginBottom: 8 }}>
          Read-only demo
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: COLORS.text2, marginBottom: 20 }}>
          This is a live demo with fictional data. Add it, scan it, play around —
          changes just aren&rsquo;t saved here.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <a
            href={demoRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...TYPE.body,
              display: "block",
              padding: "11px 14px",
              borderRadius: RADII.button,
              background: COLORS.amber,
              color: COLORS.onAmber,
              textDecoration: "none",
            }}
          >
            View on GitHub
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...TYPE.body,
              padding: "11px 14px",
              borderRadius: RADII.button,
              background: "transparent",
              border: `1px solid ${COLORS.hairline2}`,
              color: COLORS.text2,
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
