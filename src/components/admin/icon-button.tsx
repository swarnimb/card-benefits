"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";

/** Props for IconButton. */
export interface IconButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}

/**
 * Square 34px icon button used for the per-row expand / re-scan / delete actions
 * in a managed-card row (design source `ManagedRow`). Extracted from ManagedRow
 * to keep that file under the component cap — styling and behavior are unchanged.
 */
export function IconButton({ children, onClick, label }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="transition-colors hover:bg-white/[0.08]"
      style={{
        width: 34,
        height: 34,
        borderRadius: RADII.icon + 3,
        flexShrink: 0,
        background: "rgba(255,255,255,0.045)",
        border: `1px solid ${COLORS.hairline2}`,
        color: COLORS.text2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
