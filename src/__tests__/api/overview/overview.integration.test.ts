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

type Row = { benefitId: string; benefitName: string; unusedAmount: number };
const names = (rows: Row[]) => rows.map((r) => r.benefitName);

describe("GET /api/overview", () => {
  it("buckets tracked benefits from multiple cards by urgency", async () => {
    await prisma.benefit.create({
      data: {
        userCardId: userCardAId,
        name: "Dining Credit A",
        type: "credit",
        value: 120,
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
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
        classification: "discretionary-credit",
        tracked: true,
      },
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    // Annual/calendar resets are far out → both land in onTrack, none at risk.
    expect(names(data.onTrack).sort()).toEqual(["Dining Credit A", "Dining Credit B"]);
    expect(data.needsAttention).toEqual([]);
    expect(data.moneyAtRisk).toEqual({ totalUnredeemed: 0, soonestDaysUntilReset: null });
    const total = data.onTrack.reduce((s: number, r: Row) => s + r.unusedAmount, 0);
    expect(total).toBe(170);
  });

  it("includes subscription and access benefits — type is row metadata, not a filter", async () => {
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
          classification: "activation-perk",
          tracked: true,
        },
        {
          userCardId: userCardAId,
          name: "Streaming Sub",
          type: "subscription",
          value: 15,
          resetPeriod: "annual",
          resetAnchor: "calendar",
          category: "streaming",
          classification: "discretionary-credit",
          tracked: true,
        },
        {
          userCardId: userCardAId,
          name: "Travel Credit",
          type: "credit",
          value: 100,
          resetPeriod: "annual",
          resetAnchor: "calendar",
          category: "travel",
          classification: "discretionary-credit",
          tracked: true,
        },
      ],
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    const onTrackNames = names(data.onTrack);
    // Subscription and access are NO LONGER filtered out (PRD F6 urgency-primary).
    expect(onTrackNames).toContain("Lounge Access");
    expect(onTrackNames).toContain("Streaming Sub");
    expect(onTrackNames).toContain("Travel Credit");
  });

  it("does not include any tracked=false benefit in any bucket", async () => {
    await prisma.benefit.createMany({
      data: [
        {
          userCardId: userCardAId,
          name: "Tracked Travel Credit",
          type: "credit",
          value: 100,
          resetPeriod: "annual",
          resetAnchor: "calendar",
          category: "travel",
          classification: "discretionary-credit",
          tracked: true,
        },
        {
          userCardId: userCardAId,
          name: "Auto Earn Points",
          type: "perk",
          value: 5000,
          resetPeriod: "annual",
          resetAnchor: "calendar",
          category: "shopping",
          classification: "auto-earn",
          tracked: false,
        },
      ],
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    const allNames = [
      ...names(data.needsAttention),
      ...names(data.onTrack),
      ...names(data.done),
    ];
    expect(allNames).toContain("Tracked Travel Credit");
    expect(allNames).not.toContain("Auto Earn Points");
  });

  it("sorts needsAttention by soonest reset (most urgent first)", async () => {
    const benefit1 = await prisma.benefit.create({
      data: {
        userCardId: userCardAId,
        name: "Urgent Credit",
        type: "credit",
        value: 50,
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
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
        classification: "discretionary-credit",
        tracked: true,
      },
    });

    // Pre-insert open periods with near-future periodEnd (< 7 days → expiring soon).
    // ensureCurrentPeriod returns an existing open period if periodEnd > now.
    const now = new Date();
    const soonerEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
    const laterEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days

    await prisma.benefitPeriod.create({
      data: { benefitId: benefit1.id, periodStart: now, periodEnd: soonerEnd, usedAmount: 0, status: "open" },
    });
    await prisma.benefitPeriod.create({
      data: { benefitId: benefit2.id, periodStart: now, periodEnd: laterEnd, usedAmount: 0, status: "open" },
    });

    const res = await makeRequest();
    expect(res.status).toBe(200);
    const data = await res.json();

    const index1 = data.needsAttention.findIndex((r: Row) => r.benefitId === benefit1.id);
    const index2 = data.needsAttention.findIndex((r: Row) => r.benefitId === benefit2.id);
    expect(index1).toBeGreaterThanOrEqual(0);
    expect(index2).toBeGreaterThanOrEqual(0);
    expect(index1).toBeLessThan(index2); // 2-day before 5-day
    expect(data.moneyAtRisk.soonestDaysUntilReset).toBeGreaterThanOrEqual(0);
    expect(data.moneyAtRisk.totalUnredeemed).toBe(100); // 50 + 50 unredeemed
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("Unauthorized"));

    const res = await makeRequest();
    expect(res.status).toBe(401);
  });
});
