"use client";

import { COLORS, RADII } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import { fieldInputStyle } from "./edit-fields";
import { SparkIcon } from "./icons";

/**
 * Presentational chrome for the benefit review gate, extracted to keep
 * `benefit-review-gate` (state/handlers/confirm logic) < 200 lines. These are
 * pure render components — no state, no fetch, no behavior change.
 */

/** AI summary banner: "AI found N benefits" + the review hint. */
export function AiBanner({
  benefitCount,
  lowCount,
}: {
  benefitCount: number;
  lowCount: number;
}) {
  return (
    <div style={{ padding: "0 16px 14px" }}>
      <div
        style={{
          padding: "13px 15px",
          borderRadius: RADII.button,
          background: "rgba(255,255,255,0.025)",
          border: `1px solid ${COLORS.hairline}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: RADII.icon - 1,
              background: COLORS.amberSoft,
              color: COLORS.amber,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {SparkIcon}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, letterSpacing: -0.1 }}>
            AI found {benefitCount} benefit{benefitCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.text3, lineHeight: 1.5 }}>
          {lowCount > 0 ? (
            <>
              Check the {lowCount} marked{" "}
              <span style={{ color: COLORS.amber, fontWeight: 500 }}>Review</span>, edit anything,
              then confirm. Nothing is saved until you do.
            </>
          ) : (
            <>Edit anything that looks off, then confirm. Nothing is saved until you do.</>
          )}
        </div>
      </div>
    </div>
  );
}

/** Amber scrape/parse error banner with a manual-entry hint. */
export function ScrapeErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ padding: "0 16px 14px" }}>
      <div
        style={{
          padding: "13px 15px",
          borderRadius: RADII.button,
          background: COLORS.amberSoft,
          border: `1px solid ${COLORS.amberBorder}`,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.amber }}>{message}</div>
        <div style={{ fontSize: 12, color: COLORS.text3, marginTop: 4 }}>
          Add benefits manually below
        </div>
      </div>
    </div>
  );
}

/** Editable annual-fee field block (CONSTRAINT-21). */
export function AnnualFeeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ padding: "0 16px 12px" }}>
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
        Annual fee
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, ...fieldInputStyle, width: 140 }}>
        <span style={{ color: COLORS.text3, fontSize: 14 }}>$</span>
        <input
          id="annual-fee"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          aria-label="Annual fee in dollars"
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
    </div>
  );
}

/**
 * Amber inline error surface for the gate's save/cancel failures (EH-01).
 * `testId` is set to "cancel-error" for the cancel surface so the admin-page
 * test can assert the loud, contextual message.
 */
export function GateErrorMessage({
  message,
  testId,
  padBottom = 8,
}: {
  message: string;
  testId?: string;
  padBottom?: number;
}) {
  return (
    <p
      style={{ padding: `0 16px ${padBottom}px`, fontSize: 12.5, color: COLORS.amber }}
      role="alert"
      data-testid={testId}
    >
      {message}
    </p>
  );
}

/** Running-total footer: "N of M tracked" + "up to $X/yr tracked". */
export function RunningTotal({
  trackedCount,
  totalCount,
  trackedTotal,
}: {
  trackedCount: number;
  totalCount: number;
  trackedTotal: number;
}) {
  return (
    <div
      style={{
        margin: "0 16px 8px",
        padding: "12px 15px",
        borderRadius: RADII.control,
        background: "rgba(255,255,255,0.02)",
        border: `1px dashed ${COLORS.hairline2}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 12.5, color: COLORS.text3 }}>
        {trackedCount} of {totalCount} tracked
      </span>
      <span style={{ fontSize: 13, color: COLORS.text2 }}>
        up to{" "}
        <span style={{ color: COLORS.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {usd(trackedTotal)}
        </span>
        /yr tracked
      </span>
    </div>
  );
}
