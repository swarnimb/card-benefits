"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import { BenefitEditPanel } from "./benefit-edit-panel";
import { resetWindowLabel } from "./edit-fields";
import { LowConfidenceNote } from "./low-confidence-note";
import { CheckIcon, ChevronDown } from "./icons";
import type { DraftBenefit } from "@/types/benefit";

/** Props for BenefitEditRow. */
export interface BenefitEditRowProps {
  benefit: DraftBenefit;
  onChange: (updated: DraftBenefit) => void;
  onRemove: () => void;
  showNameError?: boolean;
  /** When false, the include-checkbox is hidden (excluded-disclosure context). */
  showInclude?: boolean;
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
  const low = benefit.confidence === "low";
  const nameInvalid = Boolean(showNameError && !benefit.name.trim());
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
        border: `1px solid ${included && low ? COLORS.amberBorder : COLORS.hairline}`,
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
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
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
                {benefit.value && benefit.value > 0 && (
                  <span style={{ fontSize: 10.5, color: COLORS.text4, marginTop: 1 }}>
                    {resetWindowLabel(benefit.resetPeriod)}
                  </span>
                )}
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
      {low && !open && benefit.note && <LowConfidenceNote note={benefit.note} />}

      <BenefitEditPanel
        benefit={benefit}
        open={open}
        low={low}
        nameInvalid={nameInvalid}
        update={update}
        onRemove={onRemove}
      />
    </div>
  );
}
