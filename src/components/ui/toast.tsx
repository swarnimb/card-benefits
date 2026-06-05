"use client";

import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII, SHADOWS } from "@/lib/ui/tokens";
import { CheckIcon } from "@/components/admin/icons";

/** Props for Toast. */
export interface ToastProps {
  /** Toast message; null/empty hides it (parent controls dismiss timer). */
  text: string;
}

/**
 * Bottom success toast (design source `Toast`, CONSTRAINT-20). Fixed within the
 * app column. Fired ONLY on card add / card remove from the Admin flow — never
 * on benefit tracking changes (those stay inline on the Cards screen). The
 * parent owns the auto-dismiss timer (~2.6s).
 */
export function Toast({ text }: ToastProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      data-testid="admin-toast"
      className="fixed left-0 right-0 mx-auto w-full max-w-[420px]"
      style={{ bottom: 80, zIndex: 60, paddingLeft: 16, paddingRight: 16 }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.32, ease: EASING }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 16px",
          borderRadius: RADII.control,
          background: COLORS.surface2,
          border: `1px solid ${COLORS.hairline2}`,
          boxShadow: SHADOWS.toast,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: RADII.pill,
            flexShrink: 0,
            background: COLORS.greenDim,
            color: COLORS.green,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckIcon s={12} />
        </span>
        <span style={{ fontSize: 13, color: COLORS.text, letterSpacing: -0.1 }}>{text}</span>
      </div>
    </motion.div>
  );
}
