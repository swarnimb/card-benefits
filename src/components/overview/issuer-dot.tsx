"use client";

import { OV } from "./tokens";

interface IssuerDotProps {
  /** The card's catalog color (OverviewBenefit.cardColor / SparkbarSegment.issuerColor). */
  color: string;
  size?: number;
}

/**
 * Small colored issuer marker — ported from the design source `IssuerDot`.
 * Color is the per-card catalog color (already on the data), not a token-key
 * lookup, so each card shows its own issuer identity.
 */
export function IssuerDot({ color, size = 7 }: IssuerDotProps) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 0 1px ${OV.bg}, 0 0 6px ${color}44`,
      }}
    />
  );
}
