"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";
import { SearchIcon } from "./icons";

const inputBase = {
  flex: 1,
  background: "transparent",
  border: 0,
  outline: "none",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "inherit",
  letterSpacing: -0.1,
} as const;

/**
 * Search box for the add-card picker, extracted to keep `add-picker`
 * (state/fetch/handlers) < 200 lines. Pure render — no behavior change.
 */
export function PickerSearch({
  query,
  onChange,
}: {
  query: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "11px 14px",
          borderRadius: RADII.control,
          background: COLORS.surface,
          border: `1px solid ${COLORS.hairline2}`,
        }}
      >
        <span style={{ color: COLORS.text3, display: "inline-flex", flexShrink: 0 }}>
          {SearchIcon}
        </span>
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search issuers and cards"
          aria-label="Search issuers and cards"
          style={inputBase}
        />
      </div>
    </div>
  );
}
