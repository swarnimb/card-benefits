"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";
import { CheckIcon, PlusIcon } from "./icons";
import type { DraftBenefit } from "@/types/benefit";

/**
 * Action controls + factory for the review gate, extracted to keep
 * `benefit-review-gate` (state/handlers/confirm logic) < 200 lines. Pure render
 * + a stateless factory — no behavior change.
 */

/** A fresh, user-authored benefit row (high confidence → review-only, stripped before persistence). */
export function makeBlankBenefit(): DraftBenefit {
  return {
    name: "",
    description: null,
    type: "credit",
    value: null,
    valueUnit: "dollars",
    resetPeriod: "monthly",
    resetAnchor: "calendar",
    category: "general",
    classification: "discretionary-credit",
    tracked: true,
    setAndForget: false,
    confidence: "high",
  };
}

/** Sticky-footer confirm button for the review gate. */
export function ConfirmFooterButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "15px",
        borderRadius: RADII.button,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "rgba(255,255,255,0.06)" : COLORS.amber,
        border: "none",
        color: disabled ? COLORS.text4 : COLORS.onAmber,
        fontSize: 14.5,
        fontWeight: 600,
        fontFamily: "inherit",
        letterSpacing: -0.1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {!disabled && <CheckIcon s={13} />}
      {label}
    </button>
  );
}

/** "+ Add benefit" affordance that appends a blank row. */
export function AddBenefitButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ padding: "0 16px 12px" }}>
      <button
        type="button"
        onClick={onClick}
        aria-label="Add benefit"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 13px",
          borderRadius: RADII.input + 1,
          cursor: "pointer",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${COLORS.hairline2}`,
          color: COLORS.text2,
          fontSize: 12.5,
          fontWeight: 500,
          fontFamily: "inherit",
        }}
      >
        {PlusIcon} Add benefit
      </button>
    </div>
  );
}
