import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t28_user__"),
}));

import { POST as ADD_CARD } from "@/app/api/user-cards/route";
import { POST as CONFIRM_BENEFITS } from "@/app/api/benefits/confirm/route";
import { GET as GET_BENEFITS } from "@/app/api/user-cards/[id]/benefits/route";
import { POST as UPDATE_USAGE } from "@/app/api/benefits/[id]/usage/route";
import { GET as GET_OVERVIEW } from "@/app/api/overview/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t28_user__";

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t28_" } } });
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t28_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t28_" } } });
});

function req(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("add card flow → card appears after confirm", () => {
  it("add card + confirm benefits → GET benefits returns confirmed benefits", async () => {
    // Step 1: Add a custom card
    const addRes = await ADD_CARD(
      req("/api/user-cards", { customIssuer: "__t28_Issuer", customName: "__t28_Card" })
    );
    expect(addRes.status).toBe(201);
    const { id: userCardId } = await addRes.json();

    // Step 2: Confirm benefits
    const benefits = [
      {
        name: "Travel Credit",
        description: null,
        type: "credit",
        value: 300,
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "travel",
        isTrackable: true,
      },
      {
        name: "Lounge Access",
        description: null,
        type: "access",
        value: null,
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "lounge",
        isTrackable: false,
      },
    ];
    const confirmRes = await CONFIRM_BENEFITS(
      req("/api/benefits/confirm", { userCardId, benefits })
    );
    expect(confirmRes.status).toBe(200);

    // Step 3: GET benefits — should return the 2 confirmed benefits with period data
    const getRes = await GET_BENEFITS(
      new NextRequest(`http://localhost/api/benefits/${userCardId}`),
      { params: Promise.resolve({ id: userCardId }) }
    );
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(data).toHaveLength(2);

    const travel = data.find((b: { name: string }) => b.name === "Travel Credit");
    expect(travel.type).toBe("credit");
    expect(travel.value).toBe(300);
    expect(travel.currentPeriod).toBeDefined();
    expect(travel.currentPeriod.usedAmount).toBe(0);

    const lounge = data.find((b: { name: string }) => b.name === "Lounge Access");
    expect(lounge.type).toBe("access");
    expect(lounge.currentPeriod).toBeNull();
  });
});

describe("usage update → overview totals reflect change", () => {
  it("update usage on a benefit → overview shows updated used amount", async () => {
    // Setup: card + benefit
    const card = await prisma.card.create({
      data: { issuer: "Chase", name: "__t28_OverviewCard", scrapeUrl: null, defaultColor: "#1a56db" },
    });
    const userCard = await prisma.userCard.create({
      data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
    });
    const benefit = await prisma.benefit.create({
      data: {
        userCardId: userCard.id,
        name: "Dining Credit",
        type: "credit",
        value: 50,
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "dining",
        isTrackable: true,
      },
    });

    // Step 1: Update usage to 30
    const usageRes = await UPDATE_USAGE(
      req(`/api/benefits/${benefit.id}/usage`, { usedAmount: 30 }),
      { params: Promise.resolve({ id: benefit.id }) }
    );
    expect(usageRes.status).toBe(200);
    const usageData = await usageRes.json();
    expect(usageData.usedAmount).toBe(30);

    // Step 2: Check overview
    const overviewRes = await GET_OVERVIEW(
      new NextRequest("http://localhost/api/overview")
    );
    expect(overviewRes.status).toBe(200);
    const overview = await overviewRes.json();

    const diningCategory = overview.categories.find(
      (c: { category: string }) => c.category === "dining"
    );
    expect(diningCategory).toBeDefined();
    expect(diningCategory.totalUsed).toBe(30);
    expect(diningCategory.totalValue).toBe(50);
  });
});
