import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t13_user__"),
}));

import { POST } from "@/app/api/benefits/[id]/usage/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t13_user__";
const OTHER_USER = "__t13_other_user__";

let testUserCardId: string;
let otherUserCardId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t13_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t13_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  const testUserCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });
  testUserCardId = testUserCard.id;

  const otherCard = await prisma.card.create({
    data: { issuer: "Amex", name: "__t13_other_card__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  const otherUserCard = await prisma.userCard.create({
    data: { userId: OTHER_USER, cardId: otherCard.id, displayOrder: 0 },
  });
  otherUserCardId = otherUserCard.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t13_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: testUserCardId } });
  await prisma.benefit.deleteMany({ where: { userCardId: otherUserCardId } });
});

async function createBenefit(userCardId: string) {
  return prisma.benefit.create({
    data: {
      userCardId,
      name: "Test Benefit",
      type: "credit",
      value: 100,
      resetPeriod: "annual",
      resetAnchor: "calendar",
      category: "dining",
      classification: "discretionary-credit",
      tracked: true,
    },
  });
}

describe("POST /api/benefits/[id]/usage", () => {
  it("updates usedAmount and returns period data", async () => {
    const benefit = await createBenefit(testUserCardId);

    const res = await POST(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}/usage`, {
        method: "POST",
        body: JSON.stringify({ usedAmount: 50 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.usedAmount).toBe(50);
    expect(data.periodStart).toBeDefined();
    expect(data.periodEnd).toBeDefined();
    expect(data.status).toBe("open");
    expect(data.id).toBeDefined();
  });

  it("returns 400 when usedAmount is negative", async () => {
    const benefit = await createBenefit(testUserCardId);

    const res = await POST(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}/usage`, {
        method: "POST",
        body: JSON.stringify({ usedAmount: -10 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("usedAmount must be a number >= 0");
  });

  it("returns 403 for benefit belonging to different user", async () => {
    const otherBenefit = await createBenefit(otherUserCardId);

    const res = await POST(
      new NextRequest(`http://localhost/api/benefits/${otherBenefit.id}/usage`, {
        method: "POST",
        body: JSON.stringify({ usedAmount: 10 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: otherBenefit.id }) }
    );

    expect(res.status).toBe(403);
  });
});
