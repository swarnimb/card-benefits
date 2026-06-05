"use client";

import { COLORS } from "@/lib/ui/tokens";

/**
 * Collapsed low-confidence note shown under a benefit row when it is not
 * expanded. Extracted to keep `benefit-edit-row` < 200 lines. Pure render — no
 * behavior change. Caller gates visibility (low && !open && note).
 */
export function LowConfidenceNote({ note }: { note: string }) {
  return (
    <div
      style={{
        padding: "0 14px 12px 47px",
        fontSize: 11.5,
        color: COLORS.amber,
        lineHeight: 1.4,
        marginTop: -4,
      }}
    >
      {note}
    </div>
  );
}
