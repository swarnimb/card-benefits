"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";

/** Props for AddBenefitActions. */
export interface AddBenefitActionsProps {
  /** Disables Save while the POST is in flight or the name is empty. */
  disabled: boolean;
  /** True while the POST is in flight — swaps the Save label to "Saving…". */
  pending: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * The Cancel / Save button pair for the inline add-benefit form (Task 84).
 * Save is amber-primary and reflects pending/invalid state; Cancel is the
 * neutral secondary action. Extracted from AddBenefitForm to keep that file
 * focused on form state — styling and behavior are unchanged.
 */
export function AddBenefitActions({ disabled, pending, onCancel, onSave }: AddBenefitActionsProps) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={onCancel}
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
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: RADII.input + 1,
          cursor: disabled ? "default" : "pointer",
          background: COLORS.amber,
          border: "1px solid transparent",
          color: COLORS.onAmber,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {pending ? "Saving…" : "Save benefit"}
      </button>
    </div>
  );
}
