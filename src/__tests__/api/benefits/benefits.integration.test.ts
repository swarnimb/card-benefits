import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t11_user__"),
}));

import { GET } from "@/app/api/user-cards/[id]/benefits/route";
import { POST as CONFIRM } from "@/app/api/benefits/confirm/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t11_user__";
const OTHER_USER = "__t11_other_user__";

let testUserCard: { id: string };
let otherUserCard: { id: string };

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t11_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t11_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  testUserCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });

  const otherCard = await prisma.card.create({
    data: { issuer: "Amex", name: "__t11_other_card__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  otherUserCard = await prisma.userCard.create({
    data: { userId: OTHER_USER, cardId: otherCard.id, displayOrder: 0 },
  });
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t11_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: testUserCard.id } });
});

describe("GET /api/user-cards/[id]/benefits", () => {
  it("returns benefits with current period data", async () => {
    await CONFIRM(
      new NextRequest("http://localhost/api/benefits/confirm", {
        method: "POST",
        body: JSON.stringify({
          userCardId: testUserCard.id,
          benefits: [{
            name: "Dining Credit",
            description: null,
            type: "credit",
            value: 120,
            resetPeriod: "annual",
            resetAnchor: "calendar",
            category: "dining",
            isTrackable: true,
            confidence: 0.95,
          }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await GET(
      new NextRequest(`http://localhost/api/benefits/${testUserCard.id}`),
      { params: Promise.resolve({ id: testUserCard.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Dining Credit");
    expect(data[0].currentPeriod).not.toBeNull();
    expect(data[0].currentPeriod.status).toBe("open");
  });

  it("returns 403 for card belonging to different user", async () => {
    const res = await GET(
      new NextRequest(`http://localhost/api/benefits/${otherUserCard.id}`),
      { params: Promise.resolve({ id: otherUserCard.id }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/benefits/confirm", () => {
  it("replaces all existing benefits and creates new periods", async () => {
    await prisma.benefit.create({
      data: {
        userCardId: testUserCard.id,
        name: "Old Benefit",
        type: "perk",
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "general",
        isTrackable: false,
      },
    });

    const res = await CONFIRM(
      new NextRequest("http://localhost/api/benefits/confirm", {
        method: "POST",
        body: JSON.stringify({
          userCardId: testUserCard.id,
          benefits: [{
            name: "Travel Credit",
            description: null,
            type: "credit",
            value: 300,
            resetPeriod: "annual",
            resetAnchor: "calendar",
            category: "travel",
            isTrackable: true,
            confidence: 0.9,
          }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const oldBenefit = await prisma.benefit.findFirst({ where: { userCardId: testUserCard.id, name: "Old Benefit" } });
    expect(oldBenefit).toBeNull();

    const newBenefit = await prisma.benefit.findFirst({ where: { userCardId: testUserCard.id, name: "Travel Credit" } });
    expect(newBenefit).not.toBeNull();

    const period = await prisma.benefitPeriod.findFirst({ where: { benefitId: newBenefit!.id } });
    expect(period?.status).toBe("open");

    const uc = await prisma.userCard.findUnique({ where: { id: testUserCard.id } });
    expect(uc!.lastVerifiedAt).not.toBeNull();
  });

  it("returns 400 when benefits array is empty", async () => {
    const res = await CONFIRM(
      new NextRequest("http://localhost/api/benefits/confirm", {
        method: "POST",
        body: JSON.stringify({ userCardId: testUserCard.id, benefits: [] }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("benefits must not be empty");
  });

  it("returns 400 when type is invalid enum value", async () => {
    const res = await CONFIRM(
      new NextRequest("http://localhost/api/benefits/confirm", {
        method: "POST",
        body: JSON.stringify({
          userCardId: testUserCard.id,
          benefits: [{
            name: "Bad Benefit",
            description: null,
            type: "invalid_type",
            value: 100,
            resetPeriod: "annual",
            resetAnchor: "calendar",
            category: "dining",
            isTrackable: true,
            confidence: 0.8,
          }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("invalid type");
  });
});
