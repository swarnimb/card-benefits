"use client";

import Link from "next/link";
import { COLORS, RADII, TYPE } from "@/lib/ui/tokens";

interface CardsTopBarProps {
  cardCount: number;
  issuerCount: number;
}

/**
 * Wallet top bar — "{N} cards · {M} issuers" eyebrow + "Wallet" title, and a
 * 36px hairline "+" button that links to /admin (the add-card flow).
 */
export function CardsTopBar({ cardCount, issuerCount }: CardsTopBarProps) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "4px 18px 18px" }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: 0.4, marginBottom: 2, color: COLORS.text3 }}>
          {cardCount} card{cardCount !== 1 ? "s" : ""} · {issuerCount} issuer
          {issuerCount !== 1 ? "s" : ""}
        </div>
        <div style={{ ...TYPE.title, color: COLORS.text }}>Wallet</div>
      </div>
      <Link
        href="/admin"
        aria-label="Add card"
        className="flex items-center justify-center transition-colors hover:bg-white/[0.07]"
        style={{
          width: 36,
          height: 36,
          borderRadius: RADII.pill,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${COLORS.hairline}`,
          color: COLORS.text2,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
