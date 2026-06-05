"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING_MODAL, RADII } from "@/lib/ui/tokens";
import { BackIcon } from "./icons";

/** Props for FlowShell. */
export interface FlowShellProps {
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  /** aria-label for the back/close button (default "Back"). */
  closeLabel?: string;
  children: ReactNode;
  /** Optional sticky footer (e.g. the Review confirm button). */
  footer?: ReactNode;
}

/**
 * Full-screen pushed-view shell for the Add / Scan / Review flows (design source
 * `FlowShell`). Renders as a flex column that fills the app shell, with a back
 * header, scrollable body, and optional sticky footer. The enter transition is
 * Framer Motion (gated on reduced motion) — the design's CSS `cm-shell-in` keyframe
 * translated to the app's motion convention.
 */
export function FlowShell({
  title,
  subtitle,
  onClose,
  closeLabel,
  children,
  footer,
}: FlowShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      style={{
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASING_MODAL }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 16px 14px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          aria-label={closeLabel || "Back"}
          className="transition-colors hover:bg-white/[0.08]"
          style={{
            width: 34,
            height: 34,
            borderRadius: RADII.pill,
            flexShrink: 0,
            background: "rgba(255,255,255,0.045)",
            border: `1px solid ${COLORS.hairline2}`,
            color: COLORS.text2,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {BackIcon}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, letterSpacing: -0.3 }}>
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11.5,
                color: COLORS.text3,
                marginTop: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {children}
        <div style={{ height: footer ? 8 : 28 }} />
      </div>

      {footer && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            flexShrink: 0,
            padding: "12px 16px 30px",
            background: `linear-gradient(to top, ${COLORS.bg} 70%, rgba(15,14,13,0))`,
            borderTop: `1px solid ${COLORS.hairline}`,
          }}
        >
          {footer}
        </div>
      )}
    </motion.div>
  );
}
