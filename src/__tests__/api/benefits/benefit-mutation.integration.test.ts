import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t12_user__"),
}));

import { PATCH, DELETE } from "@/app/api/benefits/[id]/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t12_user__";
const OTHER_USER = "__t12_other_user__";

let testUserCardId: string;
let otherUserCardId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t12_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t12_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  const testUserCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });
  testUserCardId = testUserCard.id;

  const otherCard = await prisma.card.create({
    data: { issuer: "Amex", name: "__t12_other_card__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  const otherUserCard = await prisma.userCard.create({
    data: { userId: OTHER_USER, cardId: otherCard.id, displayOrder: 0 },
  });
  otherUserCardId = otherUserCard.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t12_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: testUserCardId } });
  await prisma.benefit.deleteMany({ where: { userCardId: otherUserCardId } });
});

async function createBenefit(userCardId: string, overrides: Record<string, unknown> = {}) {
  return prisma.benefit.create({
    data: {
      userCardId,
      name: "Test Benefit",
      type: "credit",
      value: 100,
      resetPeriod: "annual",
      resetAnchor: "calendar",
      category: "dining",
      isTrackable: true,
      ...overrides,
    },
  });
}

describe("PATCH /api/benefits/[id]", () => {
  it("updates name and returns updated benefit", async () => {
    const benefit = await createBenefit(testUserCardId);

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Name");
    expect(data.type).toBe("credit");
  });

  it("resets usedAmount to 0 when type changes", async () => {
    const benefit = await createBenefit(testUserCardId, { type: "credit" });
    await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        usedAmount: 50,
        status: "open",
      },
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ type: "subscription" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const period = await prisma.benefitPeriod.findFirst({
      where: { benefitId: benefit.id, status: "open" },
    });
    expect(period?.usedAmount).toBe(0);
  });

  it("returns 403 for benefit belonging to different user", async () => {
    const otherBenefit = await createBenefit(otherUserCardId);

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${otherBenefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Should Not Update" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: otherBenefit.id }) }
    );

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/benefits/[id]", () => {
  it("removes benefit and all its periods", async () => {
    const benefit = await createBenefit(testUserCardId);
    await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        usedAmount: 0,
        status: "open",
      },
    });

    const res = await DELETE(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const deletedBenefit = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(deletedBenefit).toBeNull();

    const orphanedPeriods = await prisma.benefitPeriod.findMany({ where: { benefitId: benefit.id } });
    expect(orphanedPeriods).toHaveLength(0);
  });
});
