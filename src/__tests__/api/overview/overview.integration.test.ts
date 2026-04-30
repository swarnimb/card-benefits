import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t14_user__"),
}));

import { GET } from "@/app/api/overview/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t14_user__";

let userCardAId: string;
let userCardBId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t14_" } } });

  const cardA = await prisma.card.create({
    data: { issuer: "Chase", name: "__t14_card_a__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  const userCardA = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: cardA.id, displayOrder: 0 },
  });
  userCardAId = userCardA.id;

  const cardB = await prisma.card.create({
    data: { issuer: "Amex", name: "__t14_card_b__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  const userCardB = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: cardB.id, displayOrder: 1 },
  });
  userCardBId = userCardB.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t14_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: { in: [userCardAId, userCardBId] } } });
});

function makeRequest() {
  return GET(new NextRequest("http://localhost/api/overview"));
}

describe("GET /api/overview", () => {
  it("aggregates credits from multiple cards into correct category totals", async () => {
    await prisma.benefit.create({
      data: {
        userCardId: userCardAId,
        name: "Dining Credit A",
        type: "credit",
        value: 120,
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "dining",
        isTrackable: true,
      },
    });
    await prisma.benefit.create({
      data: {
        userCardId: userCardBId,
        name: "Dining Credit B",
        type: "credit",
        value: 50,
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "dining",
        isTrackable: true,
      },
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    const dining = data.categories.find((c: { category: string }) => c.category === "dining");
    expect(dining).toBeDefined();
    expect(dining.totalValue).toBe(170);
    expect(dining.cardCount).toBe(2);
  });

  it("excludes subscription and access benefits from categories", async () => {
    await prisma.benefit.createMany({
      data: [
        {
          userCardId: userCardAId,
          name: "Lounge Access",
          type: "access",
          value: 10,
          resetPeriod: "annual",
          resetAnchor: "calendar",
          category: "lounge",
          isTrackable: true,
        },
        {
          userCardId: userCardAId,
          name: "Streaming Sub",
          type: "subscription",
          value: 15,
          resetPeriod: "monthly",
          resetAnchor: "calendar",
          category: "streaming",
          isTrackable: true,
        },
        {
          userCardId: userCardAId,
          name: "Travel Credit",
          type: "credit",
          value: 100,
          resetPeriod: "annual",
          resetAnchor: "calendar",
          category: "travel",
          isTrackable: true,
        },
      ],
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    const categoryNames = data.categories.map((c: { category: string }) => c.category);
    expect(categoryNames).not.toContain("lounge");
    expect(categoryNames).not.toContain("streaming");
    expect(categoryNames).toContain("travel");
  });

  it("returns expiringSoon sorted by periodEnd ASC (most urgent first)", async () => {
    const benefit1 = await prisma.benefit.create({
      data: {
        userCardId: userCardAId,
        name: "Urgent Credit",
        type: "credit",
        value: 50,
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "dining",
        isTrackable: true,
      },
    });
    const benefit2 = await prisma.benefit.create({
      data: {
        userCardId: userCardBId,
        name: "Less Urgent Credit",
        type: "credit",
        value: 50,
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "travel",
        isTrackable: true,
      },
    });

    // Pre-insert open periods with near-future periodEnd to trigger isExpiringSoon (< 7 days)
    // ensureCurrentPeriod returns an existing open period if periodEnd > now
    const now = new Date();
    const soonerEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days — more urgent
    const laterEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);  // 5 days — less urgent

    await prisma.benefitPeriod.create({
      data: { benefitId: benefit1.id, periodStart: now, periodEnd: soonerEnd, usedAmount: 0, status: "open" },
    });
    await prisma.benefitPeriod.create({
      data: { benefitId: benefit2.id, periodStart: now, periodEnd: laterEnd, usedAmount: 0, status: "open" },
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    const index1 = data.expiringSoon.findIndex((e: { benefitId: string }) => e.benefitId === benefit1.id);
    const index2 = data.expiringSoon.findIndex((e: { benefitId: string }) => e.benefitId === benefit2.id);
    expect(index1).toBeGreaterThanOrEqual(0);
    expect(index2).toBeGreaterThanOrEqual(0);
    expect(index1).toBeLessThan(index2); // benefit1 (2 days) comes before benefit2 (5 days)
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("Unauthorized"));

    const res = await makeRequest();
    expect(res.status).toBe(401);
  });
});
