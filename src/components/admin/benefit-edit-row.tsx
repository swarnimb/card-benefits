"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import { CheckIcon, ChevronDown, TrashIcon } from "./icons";
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

/** Props for BenefitEditRow. */
export interface BenefitEditRowProps {
  benefit: DraftBenefit;
  onChange: (updated: DraftBenefit) => void;
  onRemove: () => void;
  showNameError?: boolean;
  /** When false, the include-checkbox is hidden (excluded-disclosure context). */
  showInclude?: boolean;
}

const fieldInput = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: COLORS.bg,
  border: `1px solid ${COLORS.hairline2}`,
  borderRadius: RADII.input,
  padding: "9px 11px",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  letterSpacing: -0.1,
};

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: 0.7,
          color: COLORS.text3,
          textTransform: "uppercase",
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipPicker<T extends string>({
  options,
  value,
  onPick,
  ariaLabel,
}: {
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            aria-pressed={on}
            style={{
              padding: "7px 12px",
              borderRadius: RADII.pill,
              cursor: "pointer",
              fontFamily: "inherit",
              background: on ? COLORS.amberSoft : "rgba(255,255,255,0.04)",
              border: `1px solid ${on ? "rgba(245,158,11,0.35)" : COLORS.hairline2}`,
              color: on ? COLORS.amber : COLORS.text2,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: -0.05,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Restyled review-gate benefit row (design source `ReviewBenefitRow`). Renders
 * the include checkbox (→ toggles `tracked`), name, reset·category, the amber
 * "Review" badge + note for low-confidence drafts (review-only), the dollar
 * amount, and an expand-to-edit panel with all editable fields + discard. Keeps
 * the tracked toggle semantics: unchecking moves the row to the excluded set on
 * re-render (parent partitions by `benefit.tracked`).
 */
export function BenefitEditRow({
  benefit,
  onChange,
  onRemove,
  showNameError,
  showInclude = true,
}: BenefitEditRowProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const low = benefit.confidence === "low";
  const nameInvalid = showNameError && !benefit.name.trim();
  const included = benefit.tracked;

  function update(patch: Partial<DraftBenefit>) {
    onChange({ ...benefit, ...patch });
  }

  return (
    <div
      style={{
        borderRadius: RADII.button,
        overflow: "hidden",
        background: COLORS.surface,
        border: `1px solid ${
          included && low ? "rgba(245,158,11,0.3)" : COLORS.hairline
        }`,
        opacity: included || !showInclude ? 1 : 0.55,
        transition: "opacity 220ms ease, border-color 220ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 14px" }}>
        {showInclude && (
          <button
            type="button"
            aria-label="Toggle tracked"
            aria-pressed={included}
            title={
              included
                ? "Currently tracked — click to exclude"
                : "Currently excluded — click to track"
            }
            onClick={() => update({ tracked: !included })}
            style={{
              width: 22,
              height: 22,
              borderRadius: RADII.icon,
              flexShrink: 0,
              marginTop: 1,
              cursor: "pointer",
              background: included ? COLORS.amber : "transparent",
              border: `1.5px solid ${included ? COLORS.amber : COLORS.hairline2}`,
              color: included ? COLORS.bg : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckIcon s={12} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Edit ${benefit.name || "benefit"}`}
          style={{ all: "unset", flex: 1, minWidth: 0, cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.text,
                  letterSpacing: -0.15,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {benefit.name || "Untitled benefit"}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: COLORS.text3,
                  marginTop: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span>{benefit.resetPeriod}</span>
                <span style={{ color: COLORS.text4 }}>·</span>
                <span>{benefit.category}</span>
                {nameInvalid && (
                  <span style={{ color: COLORS.amber, fontWeight: 500 }}>Name is required</span>
                )}
                {low && (
                  <span
                    data-testid="review-badge"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 7px",
                      borderRadius: RADII.pill,
                      marginLeft: 2,
                      background: COLORS.amberSoft,
                      color: COLORS.amber,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    Review
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: COLORS.text,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: -0.3,
                }}
              >
                {benefit.value && benefit.value > 0 ? usd(benefit.value) : "—"}
              </span>
              <motion.span
                style={{ display: "inline-flex", color: COLORS.text4 }}
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.3, ease: EASING }}
              >
                {ChevronDown}
              </motion.span>
            </div>
          </div>
        </button>
      </div>

      {/* collapsed low-confidence note */}
      {low && !open && benefit.note && (
        <div
          style={{
            padding: "0 14px 12px 47px",
            fontSize: 11.5,
            color: COLORS.amber,
            lineHeight: 1.4,
            marginTop: -4,
          }}
        >
          {benefit.note}
        </div>
      )}

      {/* editor */}
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
                    ...fieldInput,
                    borderColor: nameInvalid ? COLORS.amber : COLORS.hairline2,
                  }}
                />
              </EditField>

              <div style={{ display: "flex", gap: 10 }}>
                <EditField label="Amount">
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 2, ...fieldInput, padding: "9px 11px" }}
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
    </div>
  );
}
