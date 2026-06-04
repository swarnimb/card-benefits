import type { PortfolioStats } from "@/types/api";

export interface PortfolioPeriodInput {
  periodStart: Date;
  periodEnd: Date | null;
  usedAmount: number;
  status: string; // "open" | "closed"
}

export interface PortfolioBenefitInput {
  tracked: boolean;
  resetPeriod: string; // "monthly" | "quarterly" | ... | "once"
  setAndForget: boolean;
  value: number | null; // dollar cap; null = unlimited
  periods: PortfolioPeriodInput[];
}

export interface PortfolioCardInput {
  annualFee: number | null;
  benefits: PortfolioBenefitInput[];
}

/**
 * Read-only portfolio aggregate (CONSTRAINT-07) — pure, never writes any field.
 * Computes three portfolio-wide figures for the Cards/Admin spaces:
 * - annualFeeTotal: sum of every card's annual fee (null treated as 0).
 * - redeemedYtd: sum of usedAmount across ALL current-year periods (open AND closed).
 * - available: remaining cap on the OPEN period only, for tracked, recurring,
 *   non-set-and-forget, capped benefits. Everything else contributes 0.
 * `now` is injectable for deterministic tests.
 */
export function computePortfolioStats(
  cards: PortfolioCardInput[],
  now: Date = new Date()
): PortfolioStats {
  const year = now.getFullYear();
  let annualFeeTotal = 0;
  let redeemedYtd = 0;
  let available = 0;

  for (const card of cards) {
    annualFeeTotal += card.annualFee ?? 0;

    for (const benefit of card.benefits) {
      for (const period of benefit.periods) {
        if (period.periodStart.getFullYear() === year) {
          redeemedYtd += period.usedAmount;
        }
      }

      const isAvailable =
        benefit.tracked &&
        benefit.resetPeriod !== "once" &&
        benefit.setAndForget === false &&
        benefit.value !== null;
      if (!isAvailable) continue;

      const openPeriod = benefit.periods.find((p) => p.status === "open");
      const used = openPeriod ? openPeriod.usedAmount : 0;
      available += Math.max(0, benefit.value! - used);
    }
  }

  return { annualFeeTotal, redeemedYtd, available };
}
