"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";

/** Props for TextButton. */
export interface TextButtonProps {
  label: string;
  onClick: () => void;
  /** Renders the label in the amber/destructive tone (e.g. Delete). */
  destructive?: boolean;
}

/**
 * Small pill text-button used for the Edit / Delete actions inside a managed
 * benefit row (Task 83/85). `destructive` tints the label amber. Extracted from
 * ManagedBenefitRow to keep that file under the component cap — styling and
 * behavior are unchanged.
 */
export function TextButton({ label, onClick, destructive }: TextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        padding: "6px 10px",
        borderRadius: RADII.chip,
        cursor: "pointer",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${COLORS.hairline2}`,
        color: destructive ? COLORS.amber : COLORS.text2,
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
