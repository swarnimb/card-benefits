import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setBenefitActivation, ActivationEngineError } from "@/lib/engine/usage";
import { prisma } from "@/lib/db";

let safBenefitId = "";
let normalBenefitId = "";

beforeAll(async () => {
  const card = await prisma.card.create({
    data: { issuer: "Amex", name: "__activation_test__", scrapeUrl: null, defaultColor: "#B8952A" },
  });
  const userCard = await prisma.userCard.create({
    data: { userId: "__activation_test__", cardId: card.id, displayOrder: 0 },
  });
  const saf = await prisma.benefit.create({
    data: {
      userCardId: userCard.id,
      name: "__activation_test_saf__",
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

  const normal = await prisma.benefit.create({
    data: {
      userCardId: userCard.id,
      name: "__activation_test_normal__",
      type: "credit",
      value: 50,
      resetPeriod: "monthly",
      resetAnchor: "calendar",
      category: "dining",
      classification: "discretionary-credit",
      tracked: true,
      setAndForget: false,
    },
  });
  normalBenefitId = normal.id;
});

beforeEach(async () => {
  // Reset activation state between tests; never touch periods/usedAmount.
  await prisma.benefit.update({ where: { id: safBenefitId }, data: { activatedAt: null } });
});

afterAll(async () => {
  await prisma.benefit.deleteMany({ where: { name: { startsWith: "__activation_test_" } } });
  await prisma.userCard.deleteMany({ where: { userId: "__activation_test__" } });
  await prisma.card.deleteMany({ where: { name: "__activation_test__" } });
});

describe("setBenefitActivation", () => {
  it("activates and deactivates a set-and-forget benefit", async () => {
    const activated = await setBenefitActivation(safBenefitId, true);
    expect(activated.activatedAt).toBeInstanceOf(Date);

    const deactivated = await setBenefitActivation(safBenefitId, false);
    expect(deactivated.activatedAt).toBeNull();
  });

  it("writes only activatedAt — never usedAmount or a BenefitPeriod", async () => {
    const before = await prisma.benefitPeriod.count({ where: { benefitId: safBenefitId } });
    await setBenefitActivation(safBenefitId, true);
    const after = await prisma.benefitPeriod.count({ where: { benefitId: safBenefitId } });
    expect(after).toBe(before);
    expect(before).toBe(0);
  });

  it("throws ActivationEngineError when benefit not found", async () => {
    await expect(setBenefitActivation("non-existent-id", true)).rejects.toBeInstanceOf(
      ActivationEngineError
    );
    await expect(setBenefitActivation("non-existent-id", true)).rejects.toMatchObject({
      fn: "setBenefitActivation",
      benefitId: "non-existent-id",
      activated: true,
    });
  });

  it("throws ActivationEngineError when benefit is not set-and-forget", async () => {
    await expect(setBenefitActivation(normalBenefitId, true)).rejects.toBeInstanceOf(
      ActivationEngineError
    );
    // Confirm the rejected benefit was not mutated.
    const unchanged = await prisma.benefit.findUniqueOrThrow({ where: { id: normalBenefitId } });
    expect(unchanged.activatedAt).toBeNull();
  });
});
