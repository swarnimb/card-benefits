"use client";

import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING_ARRAY, RADII } from "@/lib/ui/tokens";
import type { CatalogCard } from "@/types/card";
import { MiniCard } from "./mini-card";
import { ChevronRight } from "./icons";

/** Props for CatalogRow. */
export interface CatalogRowProps {
  card: CatalogCard;
  disabled: boolean;
  adding: boolean;
  duplicate: boolean;
  onAdd: (catalogCardId: string) => void;
}

/**
 * A single catalog card row in the add picker (extracted to keep `add-picker` <
 * 200 lines). Clicking it POSTs the card via the parent's `onAdd`; surfaces the
 * adding/duplicate states inline.
 */
export function CatalogRow({ card, disabled, adding, duplicate, onAdd }: CatalogRowProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      onClick={() => onAdd(card.id)}
      disabled={disabled}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASING_ARRAY }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "12px 14px",
        borderRadius: RADII.button,
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        width: "100%",
      }}
    >
      <MiniCard color={card.defaultColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.text,
            letterSpacing: -0.2,
          }}
        >
          {card.name}
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.text3, marginTop: 3 }}>{card.issuer}</div>
      </div>
      {adding ? (
        <span style={{ fontSize: 11.5, color: COLORS.amber, flexShrink: 0 }}>Adding…</span>
      ) : duplicate ? (
        <span style={{ fontSize: 11, color: COLORS.amber, flexShrink: 0 }}>Already added</span>
      ) : (
        <span style={{ color: COLORS.text4, display: "inline-flex", flexShrink: 0 }}>
          {ChevronRight}
        </span>
      )}
    </motion.button>
  );
}
