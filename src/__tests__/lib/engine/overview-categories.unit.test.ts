import { describe, it, expect } from "vitest";
import {
  mapCategoryToGroup,
  buildActiveCreditsByCategory,
  buildSparkbarSegments,
  buildOverviewTriage,
} from "@/lib/engine/expiring";
import type { OverviewBenefit } from "@/types/api";
import type { BenefitWithPeriod, BenefitCategory } from "@/types/benefit";
import type { UserCardWithBenefits } from "@/types/card";

function makeRow(overrides: Partial<OverviewBenefit> = {}): OverviewBenefit {
  return {
    benefitId: "b1",
    benefitName: "Credit",
    cardName: "Card",
    issuer: "Chase",
    cardColor: "#117ACA",
    type: "credit",
    category: "general",
    unusedAmount: 10,
    daysUntilReset: 30,
    cardId: "uc1",
    value: 10,
    usedAmount: 0,
    resetPeriod: "monthly",
    setAndForget: false,
    ...overrides,
  };
}

function makeBenefit(overrides: Partial<BenefitWithPeriod> = {}): BenefitWithPeriod {
  const periodEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // far future → onTrack
  return {
    id: "b1",
    userCardId: "uc1",
    name: "Dining Credit",
    description: null,
    type: "credit",
    value: 50,
    valueUnit: "dollars",
    resetPeriod: "monthly",
    resetAnchor: "calendar",
    category: "dining",
    classification: "discretionary-credit",
    source: "scraped",
    tracked: true,
    setAndForget: false,
    activatedAt: null,
    createdAt: new Date(),
    currentPeriod: { id: "p1", periodStart: new Date(), periodEnd, usedAmount: 0, status: "open" },
    ...overrides,
  };
}

function makeCard(id: string, benefits: BenefitWithPeriod[]): UserCardWithBenefits {
  return {
    id,
    userId: "user1",
    cardId: "card1",
    displayOrder: 0,
    lastVerifiedAt: null,
    statementDay: null,
    anniversaryDate: null,
    createdAt: new Date(),
    card: { id: "card1", issuer: "Chase", name: "Sapphire", scrapeUrl: null, defaultColor: "#117ACA" },
    benefits,
  };
}

describe("mapCategoryToGroup", () => {
  it("maps all 7 categories correctly", () => {
    const cases: [BenefitCategory, string][] = [
      ["dining", "Dining"],
      ["travel", "Travel"],
      ["lounge", "Travel"],
      ["streaming", "Lifestyle"],
      ["shopping", "Lifestyle"],
      ["general", "Lifestyle"],
      ["wellness", "Wellness"],
    ];
    for (const [category, group] of cases) {
      expect(mapCategoryToGroup(category)).toBe(group);
    }
  });

  it("falls back to Lifestyle for an unknown/stale category string", () => {
    expect(mapCategoryToGroup("entertainment" as BenefitCategory)).toBe("Lifestyle");
  });
});

describe("buildActiveCreditsByCategory", () => {
  it("omits empty category groups from output", () => {
    const credits = [
      makeRow({ benefitId: "d1", category: "dining", unusedAmount: 5 }),
      makeRow({ benefitId: "w1", category: "wellness", unusedAmount: 5 }),
    ];
    const groups = buildActiveCreditsByCategory(credits).map((g) => g.group);
    expect(groups).toContain("Dining");
    expect(groups).toContain("Wellness");
    expect(groups).not.toContain("Travel");
    expect(groups).not.toContain("Lifestyle");
  });

  it("groups, sums totals, sorts groups by remaining desc and credits within by remaining desc", () => {
    const credits = [
      // Travel group: lounge + travel → totalRemaining 30, 2 distinct cards
      makeRow({ benefitId: "t1", category: "travel", cardId: "ucA", unusedAmount: 10, usedAmount: 2, value: 12 }),
      makeRow({ benefitId: "t2", category: "lounge", cardId: "ucB", unusedAmount: 20, usedAmount: 0, value: 20 }),
      // Dining group: totalRemaining 5, 1 card
      makeRow({ benefitId: "d1", category: "dining", cardId: "ucA", unusedAmount: 5, usedAmount: 1, value: 6 }),
    ];

    const result = buildActiveCreditsByCategory(credits);

    expect(result.map((g) => g.group)).toEqual(["Travel", "Dining"]); // by totalRemaining desc

    const travel = result[0];
    expect(travel.totalRemaining).toBe(30);
    expect(travel.totalUsed).toBe(2);
    expect(travel.totalValue).toBe(32);
    expect(travel.creditCount).toBe(2);
    expect(travel.cardCount).toBe(2);
    // credits within sorted by unusedAmount desc → t2 (20) before t1 (10)
    expect(travel.credits.map((c) => c.benefitId)).toEqual(["t2", "t1"]);

    const dining = result[1];
    expect(dining.totalRemaining).toBe(5);
    expect(dining.cardCount).toBe(1);
  });

  it("tie-breaks equal totalRemaining by group name ascending", () => {
    const credits = [
      makeRow({ benefitId: "t1", category: "travel", unusedAmount: 10 }),
      makeRow({ benefitId: "d1", category: "dining", unusedAmount: 10 }),
    ];
    expect(buildActiveCreditsByCategory(credits).map((g) => g.group)).toEqual(["Dining", "Travel"]);
  });
});

describe("buildSparkbarSegments", () => {
  it("weights sum to ~1 using cardColor, preserving input order", () => {
    const atRisk = [
      makeRow({ benefitId: "a", cardColor: "#AAA", unusedAmount: 30 }),
      makeRow({ benefitId: "b", cardColor: "#BBB", unusedAmount: 10 }),
    ];
    const segments = buildSparkbarSegments(atRisk);

    expect(segments.map((s) => s.benefitId)).toEqual(["a", "b"]); // order preserved
    expect(segments[0].issuerColor).toBe("#AAA");
    expect(segments[0].weight).toBeCloseTo(0.75, 5);
    expect(segments[1].weight).toBeCloseTo(0.25, 5);
    expect(segments[0].remaining).toBe(30);
    const sum = segments.reduce((s, seg) => s + seg.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("returns [] when no at-risk credits (total <= 0)", () => {
    expect(buildSparkbarSegments([])).toEqual([]);
    expect(buildSparkbarSegments([makeRow({ unusedAmount: 0 })])).toEqual([]);
  });
});

describe("buildOverviewTriage — activeByCategory + sparkbar", () => {
  it("populates activeByCategory and sparkbar without changing moneyAtRisk", () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    // At-risk: $40 dining resets in 2 days.
    const atRisk = makeBenefit({
      id: "atrisk", category: "dining", value: 50,
      currentPeriod: { id: "pr", periodStart: new Date(), periodEnd: soon, usedAmount: 10, status: "open" },
    });
    // onTrack: $30 travel far-future.
    const active = makeBenefit({ id: "active", category: "travel", value: 30 });

    const data = buildOverviewTriage([makeCard("uc1", [atRisk, active])]);

    // moneyAtRisk unchanged: sums needsAttention unused (50 - 10 = 40).
    expect(data.moneyAtRisk.totalUnredeemed).toBe(40);
    expect(data.moneyAtRisk.soonestDaysUntilReset).toBe(data.needsAttention[0].daysUntilReset);

    // sparkbar built from needsAttention (single at-risk credit → weight 1).
    expect(data.sparkbar.map((s) => s.benefitId)).toEqual(["atrisk"]);
    expect(data.sparkbar[0].weight).toBeCloseTo(1, 5);

    // activeByCategory built from onTrack only (the travel credit).
    expect(data.activeByCategory.map((g) => g.group)).toEqual(["Travel"]);
    expect(data.activeByCategory[0].credits.map((c) => c.benefitId)).toEqual(["active"]);
    expect(data.activeByCategory[0].totalRemaining).toBe(30);
  });

  it("returns empty activeByCategory and sparkbar when there are no credits", () => {
    const data = buildOverviewTriage([]);
    expect(data.activeByCategory).toEqual([]);
    expect(data.sparkbar).toEqual([]);
  });
});
