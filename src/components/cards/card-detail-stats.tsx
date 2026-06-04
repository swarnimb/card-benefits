"use client";

import { COLORS, TYPE } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import type { BenefitWithPeriod } from "@/types/benefit";

interface CardDetailStatsProps {
  /** That card's scrape-derived annual fee; null renders an em-dash. */
  annualFee: number | null | undefined;
  benefits: BenefitWithPeriod[];
}

/**
 * Per-card realized figures shown under the hero card (CONSTRAINT-19: realized
 * value belongs on the Cards space).
 *  - Annual:    the card's annual fee (null → "—")
 *  - Available: Σ unredeemed across tracked, non-set-and-forget benefits
 *  - Redeemed:  Σ used this period
 * Only dollar-valued benefits with an open period contribute (points-unit and
 * unlimited/null-value benefits do not move the dollar totals).
 */
export function CardDetailStats({ annualFee, benefits }: CardDetailStatsProps) {
  let available = 0;
  let redeemed = 0;
  for (const b of benefits) {
    if (!b.tracked || b.setAndForget) continue;
    if (b.valueUnit !== "dollars") continue;
    const used = b.currentPeriod?.usedAmount ?? 0;
    redeemed += used;
    if (b.value !== null) available += Math.max(0, b.value - used);
  }

  const tiles: { label: string; value: string; tone: string }[] = [
    { label: "Annual", value: annualFee == null ? "—" : usd(annualFee), tone: COLORS.text },
    { label: "Available", value: usd(available), tone: COLORS.amber },
    { label: "Redeemed", value: usd(redeemed), tone: COLORS.green },
  ];

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 0,
        borderBottom: `1px solid ${COLORS.hairline}`,
        paddingBottom: 22,
      }}
    >
      {tiles.map((s, i) => (
        <div
          key={s.label}
          style={{
            paddingLeft: i === 0 ? 0 : 14,
            borderLeft: i === 0 ? "none" : `1px solid ${COLORS.hairline}`,
          }}
        >
          <div
            className="uppercase"
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: 0.9,
              color: COLORS.text3,
              marginBottom: 6,
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              ...TYPE.stat,
              fontSize: 17,
              letterSpacing: -0.4,
              color: s.tone,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
