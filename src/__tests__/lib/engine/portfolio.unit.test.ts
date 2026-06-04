import { describe, it, expect } from "vitest";
import { computePortfolioStats } from "@/lib/engine/portfolio";
import type {
  PortfolioCardInput,
  PortfolioBenefitInput,
  PortfolioPeriodInput,
} from "@/lib/engine/portfolio";

const NOW = new Date("2026-06-15T00:00:00Z");

function makePeriod(overrides: Partial<PortfolioPeriodInput> = {}): PortfolioPeriodInput {
  return {
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-30T00:00:00Z"),
    usedAmount: 0,
    status: "open",
    ...overrides,
  };
}

function makeBenefit(overrides: Partial<PortfolioBenefitInput> = {}): PortfolioBenefitInput {
  return {
    tracked: true,
    resetPeriod: "monthly",
    setAndForget: false,
    value: 50,
    periods: [makePeriod()],
    ...overrides,
  };
}

function makeCard(overrides: Partial<PortfolioCardInput> = {}): PortfolioCardInput {
  return {
    annualFee: 95,
    benefits: [makeBenefit()],
    ...overrides,
  };
}

describe("computePortfolioStats", () => {
  it("computePortfolioStats sums redeemed/available/fees correctly", () => {
    // Card A: fee 695. Benefit cap 50, open period used 20 (avail 30, redeemed 20).
    // Card B: fee 95. Benefit cap 100, open period used 40 (avail 60, redeemed 40),
    //   plus a closed prior period this year used 10 (redeemed +10, no avail effect).
    const cardA = makeCard({
      annualFee: 695,
      benefits: [makeBenefit({ value: 50, periods: [makePeriod({ usedAmount: 20, status: "open" })] })],
    });
    const cardB = makeCard({
      annualFee: 95,
      benefits: [
        makeBenefit({
          value: 100,
          periods: [
            makePeriod({ usedAmount: 40, status: "open" }),
            makePeriod({
              periodStart: new Date("2026-05-01T00:00:00Z"),
              periodEnd: new Date("2026-05-31T00:00:00Z"),
              usedAmount: 10,
              status: "closed",
            }),
          ],
        }),
      ],
    });

    const stats = computePortfolioStats([cardA, cardB], NOW);

    expect(stats.annualFeeTotal).toBe(790); // 695 + 95
    expect(stats.redeemedYtd).toBe(70); // 20 + 40 + 10
    expect(stats.available).toBe(90); // (50-20) + (100-40)
  });

  it("null annualFee excluded from total", () => {
    const cardWithFee = makeCard({ annualFee: 250, benefits: [] });
    const cardNoFee = makeCard({ annualFee: null, benefits: [] });

    const stats = computePortfolioStats([cardWithFee, cardNoFee], NOW);

    expect(stats.annualFeeTotal).toBe(250);
  });

  it("excludes prior-year periods from redeemedYtd", () => {
    const card = makeCard({
      annualFee: 0,
      benefits: [
        makeBenefit({
          value: 50,
          periods: [
            makePeriod({ usedAmount: 15, status: "open" }),
            makePeriod({
              periodStart: new Date("2025-12-01T00:00:00Z"),
              periodEnd: new Date("2025-12-31T00:00:00Z"),
              usedAmount: 999,
              status: "closed",
            }),
          ],
        }),
      ],
    });

    const stats = computePortfolioStats([card], NOW);

    expect(stats.redeemedYtd).toBe(15); // prior-year 999 excluded
  });

  it("untracked, once, set-and-forget, and value:null benefits contribute 0 to available", () => {
    const card = makeCard({
      annualFee: 0,
      benefits: [
        makeBenefit({ tracked: false, value: 100, periods: [makePeriod({ usedAmount: 0 })] }),
        makeBenefit({ resetPeriod: "once", value: 100, periods: [makePeriod({ usedAmount: 0 })] }),
        makeBenefit({ setAndForget: true, value: 100, periods: [makePeriod({ usedAmount: 0 })] }),
        makeBenefit({ value: null, periods: [makePeriod({ usedAmount: 0 })] }),
      ],
    });

    const stats = computePortfolioStats([card], NOW);

    expect(stats.available).toBe(0);
  });

  it("available reads only the open period, ignoring closed ones", () => {
    const card = makeCard({
      annualFee: 0,
      benefits: [
        makeBenefit({
          value: 100,
          periods: [
            makePeriod({ usedAmount: 25, status: "open" }),
            makePeriod({ usedAmount: 100, status: "closed" }),
          ],
        }),
      ],
    });

    const stats = computePortfolioStats([card], NOW);

    expect(stats.available).toBe(75); // 100 - 25 (open), closed period ignored
  });

  it("treats a missing open period as 0 used (full cap available)", () => {
    const card = makeCard({
      annualFee: 0,
      benefits: [makeBenefit({ value: 50, periods: [makePeriod({ status: "closed", usedAmount: 50 })] })],
    });

    const stats = computePortfolioStats([card], NOW);

    expect(stats.available).toBe(50); // no open period → used 0 → full cap
  });

  it("returns all zeros for an empty portfolio", () => {
    expect(computePortfolioStats([], NOW)).toEqual({
      annualFeeTotal: 0,
      redeemedYtd: 0,
      available: 0,
    });
  });
});
