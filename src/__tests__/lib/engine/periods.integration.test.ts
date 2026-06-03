import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import { prisma } from "@/lib/db";

let testBenefitId = "";
let safBenefitId = "";

beforeAll(async () => {
  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__periods_test__", scrapeUrl: null, defaultColor: "#1a56db" },
  });
  const userCard = await prisma.userCard.create({
    data: { userId: "__periods_test__", cardId: card.id, displayOrder: 0 },
  });
  const benefit = await prisma.benefit.create({
    data: {
      userCardId: userCard.id,
      name: "__periods_test__",
      type: "credit",
      value: 50,
      resetPeriod: "monthly",
      resetAnchor: "calendar",
      category: "dining",
      classification: "discretionary-credit",
      tracked: true,
    },
  });
  testBenefitId = benefit.id;

  const saf = await prisma.benefit.create({
    data: {
      userCardId: userCard.id,
      name: "__periods_test_saf__",
      type: "subscription",
      value: 120,
      resetPeriod: "annual",
      resetAnchor: "calendar",
      category: "travel",
      classification: "activation-perk",
      tracked: true,
      setAndForget: true,
    },
  });
  safBenefitId = saf.id;
});

beforeEach(async () => {
  await prisma.benefitPeriod.deleteMany({ where: { benefitId: testBenefitId } });
});

afterAll(async () => {
  await prisma.benefitPeriod.deleteMany({ where: { benefit: { name: { startsWith: "__periods_test" } } } });
  await prisma.benefit.deleteMany({ where: { name: { startsWith: "__periods_test" } } });
  await prisma.userCard.deleteMany({ where: { userId: "__periods_test__" } });
  await prisma.card.deleteMany({ where: { name: "__periods_test__" } });
});

describe("ensureCurrentPeriod", () => {
  it("creates first period when none exist", async () => {
    const period = await ensureCurrentPeriod(testBenefitId);
    expect(period).not.toBeNull();
    expect(period!.benefitId).toBe(testBenefitId);
    expect(period!.status).toBe("open");
    expect(period!.usedAmount).toBe(0);
    expect(period!.periodEnd).not.toBeNull();

    const count = await prisma.benefitPeriod.count({ where: { benefitId: testBenefitId } });
    expect(count).toBe(1);
  });

  it("returns existing open period without DB write when still valid", async () => {
    const future = new Date(2099, 11, 31, 23, 59, 59, 999);
    await prisma.benefitPeriod.create({
      data: {
        benefitId: testBenefitId,
        periodStart: new Date(2099, 0, 1),
        periodEnd: future,
        usedAmount: 25,
        status: "open",
      },
    });

    const period = await ensureCurrentPeriod(testBenefitId);
    expect(period).not.toBeNull();
    expect(period!.usedAmount).toBe(25);
    expect(period!.periodEnd?.getTime()).toBe(future.getTime());

    const count = await prisma.benefitPeriod.count({ where: { benefitId: testBenefitId } });
    expect(count).toBe(1);
  });

  it("closes expired period and creates new when periodEnd is in the past", async () => {
    await prisma.benefitPeriod.create({
      data: {
        benefitId: testBenefitId,
        periodStart: new Date(2026, 1, 1),
        periodEnd: new Date(2026, 1, 28, 23, 59, 59, 999),
        usedAmount: 10,
        status: "open",
      },
    });

    const period = await ensureCurrentPeriod(testBenefitId);
    expect(period).not.toBeNull();
    expect(period!.status).toBe("open");
    expect(period!.usedAmount).toBe(0);

    const closed = await prisma.benefitPeriod.findFirst({
      where: { benefitId: testBenefitId, status: "closed" },
    });
    expect(closed).not.toBeNull();
    expect(closed!.usedAmount).toBe(10);

    const openCount = await prisma.benefitPeriod.count({
      where: { benefitId: testBenefitId, status: "open" },
    });
    expect(openCount).toBe(1);
  });

  it("does not create a period for a setAndForget benefit (CONSTRAINT-17)", async () => {
    const period = await ensureCurrentPeriod(safBenefitId);
    expect(period).toBeNull();

    const count = await prisma.benefitPeriod.count({ where: { benefitId: safBenefitId } });
    expect(count).toBe(0);
  });

  it("unchanged behavior for a normal benefit (regression)", async () => {
    const period = await ensureCurrentPeriod(testBenefitId);
    expect(period).not.toBeNull();
    expect(period!.benefitId).toBe(testBenefitId);
    expect(period!.status).toBe("open");

    const count = await prisma.benefitPeriod.count({ where: { benefitId: testBenefitId } });
    expect(count).toBe(1);
  });
});
