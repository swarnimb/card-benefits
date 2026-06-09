"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import type { ResetPeriod } from "@/types/benefit";

/**
 * Shared admin form-field primitives (extracted from `benefit-edit-row` to keep
 * each component < 200 lines and to dedupe the near-identical field-input style
 * that the edit row, review gate, and add picker each previously inlined).
 */

/** Human window suffix per reset period — clarifies the amount is per-window. */
const RESET_PERIOD_WINDOW: Record<ResetPeriod, string> = {
  monthly: "per month",
  quarterly: "per quarter",
  semiannual: "per 6 months",
  annual: "per year",
  once: "one-time",
};

/** Window suffix for a reset period (e.g. "per 6 months", "one-time"). */
export function resetWindowLabel(period: ResetPeriod): string {
  return RESET_PERIOD_WINDOW[period];
}

/**
 * Right-aligned stacked benefit amount: the dollar value (or em-dash when
 * none/zero) with a per-window suffix below it (Task 68). Pure presentation —
 * extracted from `benefit-edit-row` to keep that component < 200 lines.
 */
export function BenefitAmount({
  value,
  resetPeriod,
}: {
  value: number | null;
  resetPeriod: ResetPeriod;
}) {
  const hasValue = value !== null && value > 0;
  return (
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
        {hasValue ? usd(value as number) : "—"}
      </span>
      {hasValue && (
        <span style={{ fontSize: 10.5, color: COLORS.text4, marginTop: 1 }}>
          {resetWindowLabel(resetPeriod)}
        </span>
      )}
    </span>
  );
}

/** Canonical text-input style for admin form fields (bg surface, hairline border). */
export const fieldInputStyle = {
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

/** Uppercase label + field wrapper used throughout the benefit editor. */
export function EditField({
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

/** Pill chip-picker for single-select enum fields (type/reset/category). */
export function ChipPicker<T extends string>({
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
              border: `1px solid ${on ? COLORS.amberBorderStrong : COLORS.hairline2}`,
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
