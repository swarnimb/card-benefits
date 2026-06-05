"use client";

import { SHADOWS } from "@/lib/ui/tokens";
import { cardGradient } from "@/components/cards/card-gradient";

/** Props for MiniCard. */
export interface MiniCardProps {
  /** Base card hex (the card's `defaultColor`). */
  color: string;
  /** Optional small network/issuer tag rendered bottom-right (e.g. "VISA"). */
  network?: string;
  width?: number;
  height?: number;
}

/**
 * The small credit-card chip used as the leading visual for each managed card
 * and each catalog row (design source `MiniCard`). Reuses the canonical
 * `cardGradient` depth gradient so the mini chip matches the full card face.
 */
export function MiniCard({ color, network, width = 56, height = 38 }: MiniCardProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: 8,
        flexShrink: 0,
        background: cardGradient(color),
        position: "relative",
        overflow: "hidden",
        boxShadow: SHADOWS.miniCard,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 90% at -10% -10%, rgba(255,255,255,0.22), transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 6,
          top: 8,
          width: 11,
          height: 8,
          borderRadius: 2,
          background: "rgba(255,255,255,0.55)",
        }}
      />
      {network && (
        <div
          style={{
            position: "absolute",
            right: 6,
            bottom: 6,
            fontSize: 6.5,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {network}
        </div>
      )}
    </div>
  );
}
