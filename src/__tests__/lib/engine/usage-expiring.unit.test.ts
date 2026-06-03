import { describe, it, expect } from "vitest";
import { isExpiringSoon, buildOverviewTriage } from "@/lib/engine/expiring";
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
    valueUnit: "dollars",
    resetPeriod: "monthly",
    resetAnchor: "calendar",
    category: "dining",
    classification: "discretionary-credit",
    tracked: true,
    setAndForget: false,
    activatedAt: null,
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
    expect(isExpiringSoon(makeBenefit({ tracked: false }))).toBe(false);
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

function periodEndingInDays(days: number, usedAmount = 0) {
  return {
    id: `p-${days}`,
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    usedAmount,
    status: "open",
  };
}

describe("buildOverviewTriage", () => {
  it("sums unredeemed into moneyAtRisk and sorts needsAttention by soonest reset", () => {
    // b1: $40 unused, resets in 5 days. b2: $30 unused, resets in 2 days (more urgent).
    const b1 = makeBenefit({ id: "b1", value: 50, currentPeriod: periodEndingInDays(5, 10) });
    const b2 = makeBenefit({ id: "b2", value: 30, currentPeriod: periodEndingInDays(2, 0) });

    const { moneyAtRisk, needsAttention, onTrack, done } = buildOverviewTriage([
      makeCard("uc1", [b1, b2]),
    ]);

    expect(needsAttention.map((r) => r.benefitId)).toEqual(["b2", "b1"]); // soonest first
    expect(moneyAtRisk.totalUnredeemed).toBe(70); // 40 + 30
    expect(moneyAtRisk.soonestDaysUntilReset).toBe(needsAttention[0].daysUntilReset);
    expect(moneyAtRisk.soonestDaysUntilReset).toBeGreaterThanOrEqual(0);
    expect(onTrack).toHaveLength(0);
    expect(done).toHaveLength(0);
  });

  it("places fully-used in done and active in onTrack", () => {
    // Far-future periods so neither is expiring-soon.
    const fullyUsed = makeBenefit({ id: "used", value: 50, currentPeriod: periodEndingInDays(60, 50) });
    const active = makeBenefit({ id: "active", value: 50, currentPeriod: periodEndingInDays(60, 10) });

    const { needsAttention, onTrack, done } = buildOverviewTriage([
      makeCard("uc1", [fullyUsed, active]),
    ]);

    expect(needsAttention).toHaveLength(0);
    expect(done.map((r) => r.benefitId)).toEqual(["used"]);
    expect(onTrack.map((r) => r.benefitId)).toEqual(["active"]);
    expect(onTrack[0].unusedAmount).toBe(40);
  });

  it("excludes tracked=false from all buckets", () => {
    const tracked = makeBenefit({ id: "t", value: 50, currentPeriod: periodEndingInDays(60, 0) });
    const excluded = makeBenefit({
      id: "x", value: 999, classification: "auto-earn", tracked: false,
      currentPeriod: periodEndingInDays(2, 0), // would be needsAttention if tracked
    });

    const { moneyAtRisk, needsAttention, onTrack, done } = buildOverviewTriage([
      makeCard("uc1", [tracked, excluded]),
    ]);

    const allIds = [...needsAttention, ...onTrack, ...done].map((r) => r.benefitId);
    expect(allIds).not.toContain("x");
    expect(allIds).toContain("t");
    expect(moneyAtRisk.totalUnredeemed).toBe(0); // excluded never contributes
  });

  it("excludes an active set-and-forget benefit from needsAttention and treats it as realized (done)", () => {
    // Period is deliberately urgent (resets in 1 day, fully unused) — a normal
    // benefit here would be needsAttention. The set-and-forget guard must override.
    const active = makeBenefit({
      id: "saf-active", value: 120, setAndForget: true, activatedAt: new Date(),
      currentPeriod: periodEndingInDays(1, 0),
    });

    const { moneyAtRisk, needsAttention, onTrack, done } = buildOverviewTriage([
      makeCard("uc1", [active]),
    ]);

    expect(needsAttention).toHaveLength(0);
    expect(onTrack).toHaveLength(0);
    expect(done.map((r) => r.benefitId)).toEqual(["saf-active"]);
    expect(done[0].unusedAmount).toBe(0); // realized — nothing at risk
    expect(moneyAtRisk.totalUnredeemed).toBe(0);
  });

  it("keeps a not-set-up set-and-forget benefit calm — no urgency, no money at risk", () => {
    const notSetUp = makeBenefit({
      id: "saf-idle", value: 120, setAndForget: true, activatedAt: null,
      currentPeriod: periodEndingInDays(1, 0), // would be urgent if it were a normal benefit
    });

    const { moneyAtRisk, needsAttention, onTrack, done } = buildOverviewTriage([
      makeCard("uc1", [notSetUp]),
    ]);

    expect(needsAttention).toHaveLength(0);
    expect(done).toHaveLength(0);
    expect(onTrack.map((r) => r.benefitId)).toEqual(["saf-idle"]); // calm, non-urgent
    expect(onTrack[0].unusedAmount).toBe(0);
    expect(moneyAtRisk.totalUnredeemed).toBe(0);
  });

  it("leaves normal-benefit triage unchanged when mixed with set-and-forget (regression)", () => {
    const normal = makeBenefit({ id: "normal", value: 30, currentPeriod: periodEndingInDays(2, 0) });
    const active = makeBenefit({
      id: "saf", value: 200, setAndForget: true, activatedAt: new Date(),
      currentPeriod: periodEndingInDays(1, 0),
    });

    const { moneyAtRisk, needsAttention, onTrack, done } = buildOverviewTriage([
      makeCard("uc1", [normal, active]),
    ]);

    expect(needsAttention.map((r) => r.benefitId)).toEqual(["normal"]);
    expect(moneyAtRisk.totalUnredeemed).toBe(30); // only the normal benefit; set-and-forget adds nothing
    expect(done.map((r) => r.benefitId)).toEqual(["saf"]);
  });

  it("empty buckets and null soonest when no tracked", () => {
    const result = buildOverviewTriage([]);
    expect(result.needsAttention).toEqual([]);
    expect(result.onTrack).toEqual([]);
    expect(result.done).toEqual([]);
    expect(result.moneyAtRisk).toEqual({ totalUnredeemed: 0, soonestDaysUntilReset: null });
  });
});
