"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import { BenefitEditRow } from "./benefit-edit-row";
import { ChevronDown } from "./icons";
import type { DraftBenefit } from "@/types/benefit";

/** A draft benefit paired with its stable index in the full benefits array. */
export interface IndexedBenefit {
  benefit: DraftBenefit;
  index: number;
}

/** Props for ExcludedDisclosure. */
export interface ExcludedDisclosureProps {
  items: IndexedBenefit[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (index: number, updated: DraftBenefit) => void;
  onRemove: (index: number) => void;
  showNameError: boolean;
}

/**
 * Collapsed disclosure for auto-excluded (tracked=false) benefits (A10: excluded
 * rows always stay in the parent's state + confirm payload — this only controls
 * visibility). Restyled to the design tokens. Each row keeps its include checkbox
 * so the user can re-track an excluded benefit.
 */
export function ExcludedDisclosure({
  items,
  expanded,
  onToggle,
  onChange,
  onRemove,
  showNameError,
}: ExcludedDisclosureProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{
        borderRadius: RADII.button,
        border: `1px solid ${COLORS.hairline}`,
        background: "rgba(255,255,255,0.02)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "13px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          color: COLORS.text3,
          fontSize: 12.5,
        }}
      >
        <span>{items.length} auto-excluded as non-trackable — expand to review</span>
        <motion.span
          style={{ display: "inline-flex", flexShrink: 0, color: COLORS.text4 }}
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: EASING }}
        >
          {ChevronDown}
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { height: 0, opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 9,
                padding: "0 12px 12px",
                borderTop: `1px solid ${COLORS.hairline}`,
                paddingTop: 12,
              }}
            >
              {items.map(({ benefit, index }) => (
                <BenefitEditRow
                  key={index}
                  benefit={benefit}
                  onChange={(updated) => onChange(index, updated)}
                  onRemove={() => onRemove(index)}
                  showNameError={showNameError}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
