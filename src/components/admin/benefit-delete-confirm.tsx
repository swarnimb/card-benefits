"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING_ARRAY, RADII } from "@/lib/ui/tokens";

/** Props for BenefitDeleteConfirm. */
export interface BenefitDeleteConfirmProps {
  open: boolean;
  name: string;
  onKeep: () => void;
  onRemove: () => void;
}

/**
 * Inline expand delete-confirm for a single benefit row (Task 85) — mirrors the
 * card-level `DeleteConfirm` pattern. Shown BEFORE any DELETE; copy makes the
 * destructiveness clear (usage history is removed too). Cancel issues no request.
 */
export function BenefitDeleteConfirm({ open, name, onKeep, onRemove }: BenefitDeleteConfirmProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { height: 0, opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: EASING_ARRAY }}
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              padding: "12px 14px 14px",
              borderTop: `1px solid ${COLORS.hairline}`,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{ fontSize: 12.5, color: COLORS.text2, lineHeight: 1.45, marginBottom: 11 }}
            >
              Delete {name || "this benefit"}? Its usage history will be permanently removed.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onKeep}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: RADII.input + 1,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${COLORS.hairline2}`,
                  color: COLORS.text2,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "inherit",
                }}
              >
                Keep
              </button>
              <button
                type="button"
                onClick={onRemove}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: RADII.input + 1,
                  cursor: "pointer",
                  background: COLORS.text,
                  border: "1px solid transparent",
                  color: COLORS.bg,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                Delete benefit
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
