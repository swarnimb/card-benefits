import { describe, it, expect } from "vitest";
import { isExpiringSoon, aggregateOverview } from "@/lib/engine/expiring";
import type { BenefitWithPeriod } from "@/types/benefit";
import type { UserCardWithBenefits } from "@/types/card";

function makeBenefit(overrides: Partial<BenefitWithPeriod> = {}): BenefitWithPeriod {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return {
    id: "b1",
    userCardId: "uc1",
    name: "Dining Credit",
    description: null,
    type: "credit",
    value: 50,
    resetPeriod: "monthly",
    resetAnchor: "calendar",
    category: "dining",
    isTrackable: true,
    createdAt: new Date(),
    currentPeriod: {
      id: "p1",
      periodStart: new Date(),
      periodEnd: threeDaysFromNow,
      usedAmount: 0,
      status: "open",
    },
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
    card: { id: "card1", issuer: "Chase", name: "Sapphire Preferred", scrapeUrl: null, defaultColor: "#1a56db" },
    benefits,
  };
}

describe("isExpiringSoon", () => {
  it("returns true when credit has unused value and resets within threshold", () => {
    expect(isExpiringSoon(makeBenefit())).toBe(true);
  });

  it("returns false when benefit is fully used", () => {
    const benefit = makeBenefit({
      currentPeriod: {
        id: "p1",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        usedAmount: 50,
        status: "open",
      },
    });
    expect(isExpiringSoon(benefit)).toBe(false);
  });

  it("returns false for once-type benefits", () => {
    expect(isExpiringSoon(makeBenefit({ resetPeriod: "once" }))).toBe(false);
  });

  it("returns false when benefit is not trackable", () => {
    expect(isExpiringSoon(makeBenefit({ isTrackable: false }))).toBe(false);
  });

  it("returns false when period end is beyond the threshold", () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const benefit = makeBenefit({
      currentPeriod: {
        id: "p1",
        periodStart: new Date(),
        periodEnd: farFuture,
        usedAmount: 0,
        status: "open",
      },
    });
    expect(isExpiringSoon(benefit)).toBe(false);
  });

  it("returns true for subscription type when unused and expiring soon", () => {
    const benefit = makeBenefit({ type: "subscription", value: 15 });
    expect(isExpiringSoon(benefit)).toBe(true);
  });

  it("returns false for subscription type when already used", () => {
    const benefit = makeBenefit({
      type: "subscription",
      value: 15,
      currentPeriod: {
        id: "p1",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        usedAmount: 1,
        status: "open",
      },
    });
    expect(isExpiringSoon(benefit)).toBe(false);
  });
});

describe("aggregateOverview", () => {
  it("sums credits and perks by category, excludes subscription and access", () => {
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const period = { id: "p1", periodStart: new Date(), periodEnd: farFuture, usedAmount: 10, status: "open" };

    const diningCredit = makeBenefit({ id: "b1", type: "credit", value: 50, category: "dining", currentPeriod: period });
    const diningPerk = makeBenefit({ id: "b2", type: "perk", value: 25, category: "dining", currentPeriod: period });
    const subscription = makeBenefit({ id: "b3", type: "subscription", value: 15, category: "streaming", currentPeriod: period });
    const access = makeBenefit({ id: "b4", type: "access", value: null, category: "lounge", currentPeriod: period });

    const result = aggregateOverview([makeCard("uc1", [diningCredit, diningPerk, subscription, access])]);

    const dining = result.categories.find((c) => c.category === "dining");
    expect(dining?.totalValue).toBe(75);
    expect(dining?.totalUsed).toBe(20);
    expect(result.categories.find((c) => c.category === "streaming")).toBeUndefined();
    expect(result.categories.find((c) => c.category === "lounge")).toBeUndefined();
  });

  it("returns empty categories and expiringSoon for no cards", () => {
    const result = aggregateOverview([]);
    expect(result.categories).toEqual([]);
    expect(result.expiringSoon).toEqual([]);
  });

  it("populates expiringSoon for benefits expiring within threshold", () => {
    const soonEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const period = { id: "p1", periodStart: new Date(), periodEnd: soonEnd, usedAmount: 0, status: "open" };
    const benefit = makeBenefit({ id: "b1", value: 50, currentPeriod: period });

    const result = aggregateOverview([makeCard("uc1", [benefit])]);
    expect(result.expiringSoon).toHaveLength(1);
    expect(result.expiringSoon[0].benefitId).toBe("b1");
    expect(result.expiringSoon[0].remainingValue).toBe(50);
  });
});
