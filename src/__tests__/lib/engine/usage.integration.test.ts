import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { updateBenefitUsage } from "@/lib/engine/usage";
import { prisma } from "@/lib/db";

let testBenefitId = "";

beforeAll(async () => {
  const card = await prisma.card.create({
    data: { issuer: "Amex", name: "__usage_test__", scrapeUrl: null, defaultColor: "#B8952A" },
  });
  const userCard = await prisma.userCard.create({
    data: { userId: "__usage_test__", cardId: card.id, displayOrder: 0 },
  });
  const benefit = await prisma.benefit.create({
    data: {
      userCardId: userCard.id,
      name: "__usage_test__",
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
});

beforeEach(async () => {
  await prisma.benefitPeriod.deleteMany({ where: { benefitId: testBenefitId } });
});

afterAll(async () => {
  await prisma.benefitPeriod.deleteMany({ where: { benefit: { name: "__usage_test__" } } });
  await prisma.benefit.deleteMany({ where: { name: "__usage_test__" } });
  await prisma.userCard.deleteMany({ where: { userId: "__usage_test__" } });
  await prisma.card.deleteMany({ where: { name: "__usage_test__" } });
});

describe("updateBenefitUsage", () => {
  it("clamps to benefit.value when newAmount exceeds cap", async () => {
    const period = await updateBenefitUsage(testBenefitId, 999);
    expect(period.usedAmount).toBe(50);
    expect(period.status).toBe("open");
  });

  it("clamps to 0 when newAmount is negative", async () => {
    const period = await updateBenefitUsage(testBenefitId, -10);
    expect(period.usedAmount).toBe(0);
  });

  it("throws UsageEngineError for non-existent benefitId", async () => {
    await expect(updateBenefitUsage("non-existent-id", 10)).rejects.toMatchObject({
      fn: "updateBenefitUsage",
      benefitId: "non-existent-id",
      newAmount: 10,
    });
  });
});
