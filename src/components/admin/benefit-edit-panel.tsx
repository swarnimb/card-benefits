"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import { EditField, ChipPicker, fieldInputStyle } from "./edit-fields";
import { TrashIcon } from "./icons";
import type {
  DraftBenefit,
  BenefitType,
  ResetPeriod,
  ResetAnchor,
  BenefitCategory,
} from "@/types/benefit";

const BENEFIT_TYPES: BenefitType[] = ["credit", "subscription", "access", "perk"];
const RESET_PERIODS: ResetPeriod[] = ["monthly", "quarterly", "semiannual", "annual", "once"];
const RESET_ANCHORS: ResetAnchor[] = ["calendar", "statement", "anniversary"];
const CATEGORIES: BenefitCategory[] = [
  "dining",
  "travel",
  "streaming",
  "shopping",
  "lounge",
  "general",
  "wellness",
];

/** Props for BenefitEditPanel — the expand-to-edit editor of a benefit row. */
export interface BenefitEditPanelProps {
  benefit: DraftBenefit;
  open: boolean;
  low: boolean;
  nameInvalid: boolean;
  update: (patch: Partial<DraftBenefit>) => void;
  onRemove: () => void;
}

/**
 * The collapsible edit panel for a benefit row (extracted from `benefit-edit-row`
 * to keep that component < 200 lines). Renders the note, all editable fields, and
 * the discard button inside the animated expand region.
 */
export function BenefitEditPanel({
  benefit,
  open,
  low,
  nameInvalid,
  update,
  onRemove,
}: BenefitEditPanelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { height: 0, opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASING }}
          style={{ overflow: "hidden" }}
        >
          <div style={{ padding: "4px 14px 16px", borderTop: `1px solid ${COLORS.hairline}` }}>
            {benefit.note && (
              <div
                style={{
                  fontSize: 11.5,
                  color: low ? COLORS.amber : COLORS.text3,
                  lineHeight: 1.45,
                  padding: "12px 0 14px",
                }}
              >
                {benefit.note}
              </div>
            )}

            <EditField label="Benefit name">
              <input
                value={benefit.name}
                onChange={(e) => update({ name: e.target.value })}
                aria-label="Benefit name"
                placeholder="Benefit name"
                style={{
                  ...fieldInputStyle,
                  borderColor: nameInvalid ? COLORS.amber : COLORS.hairline2,
                }}
              />
            </EditField>

            <div style={{ display: "flex", gap: 10 }}>
              <EditField label="Amount">
                <div
                  style={{ display: "flex", alignItems: "center", gap: 2, ...fieldInputStyle, padding: "9px 11px" }}
                >
                  <span style={{ color: COLORS.text3, fontSize: 14 }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={benefit.value ?? ""}
                    onChange={(e) =>
                      update({ value: e.target.value ? Math.max(0, Number(e.target.value)) : null })
                    }
                    aria-label="Value"
                    style={{
                      background: "transparent",
                      border: 0,
                      outline: "none",
                      color: COLORS.text,
                      fontSize: 14,
                      fontFamily: "inherit",
                      width: "100%",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>
              </EditField>
            </div>

            <EditField label="Type">
              <ChipPicker
                ariaLabel="Type"
                options={BENEFIT_TYPES}
                value={benefit.type}
                onPick={(v) => update({ type: v })}
              />
            </EditField>

            <EditField label="Resets">
              <ChipPicker
                ariaLabel="Reset period"
                options={RESET_PERIODS}
                value={benefit.resetPeriod}
                onPick={(v) => update({ resetPeriod: v })}
              />
            </EditField>

            <EditField label="Reset anchor">
              <ChipPicker
                ariaLabel="Reset anchor"
                options={RESET_ANCHORS}
                value={benefit.resetAnchor}
                onPick={(v) => update({ resetAnchor: v })}
              />
            </EditField>

            <EditField label="Category">
              <ChipPicker
                ariaLabel="Category"
                options={CATEGORIES}
                value={benefit.category}
                onPick={(v) => update({ category: v })}
              />
            </EditField>

            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove benefit"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px",
                borderRadius: RADII.input + 1,
                cursor: "pointer",
                background: "transparent",
                border: `1px solid ${COLORS.hairline2}`,
                color: COLORS.text3,
                fontSize: 12.5,
                fontWeight: 500,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              {TrashIcon} Discard this benefit
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
