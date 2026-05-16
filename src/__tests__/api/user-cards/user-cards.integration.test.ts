import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__uc_test_user__"),
}));

import { GET, POST } from "@/app/api/user-cards/route";
import { DELETE } from "@/app/api/user-cards/[id]/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__uc_test_user__";
const OTHER_USER = "__uc_other_user__";

// Track Card IDs created during tests for cleanup
const trackedCardIds: string[] = [];

beforeAll(async () => {
  // Pre-run cleanup for idempotency (handles prior failed runs)
  await prisma.userCard.deleteMany({
    where: { userId: { in: [TEST_USER, OTHER_USER] } },
  });
  await prisma.card.deleteMany({
    where: { name: { startsWith: "__t9_" } },
  });
});

afterAll(async () => {
  // Step 1: Delete UserCards (cascade removes benefits + periods)
  await prisma.userCard.deleteMany({
    where: { userId: { in: [TEST_USER, OTHER_USER] } },
  });
  // Step 2: Delete tracked Card rows created during tests
  if (trackedCardIds.length > 0) {
    await prisma.card.deleteMany({ where: { id: { in: trackedCardIds } } });
  }
  // Step 3: Delete Cards with test prefix
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t9_" } } });
});

beforeEach(() => {
  mockRequireAuth.mockResolvedValue({
    user: { id: TEST_USER, email: "test@example.com" },
    expires: "2099-01-01",
  });
});

describe("GET /api/user-cards", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce({ status: 401 });
    const req = new NextRequest("http://localhost/api/user-cards");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns empty array when user has no cards", async () => {
    const req = new NextRequest("http://localhost/api/user-cards");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Only assert no cards for this specific test user — other users don't interfere
    const testUserCards = data.filter(
      (uc: { id: string }) => uc // shape check
    );
    expect(testUserCards).toHaveLength(0);
  });
});

describe("POST /api/user-cards", () => {
  it("creates UserCard and returns 201", async () => {
    const req = new NextRequest("http://localhost/api/user-cards", {
      method: "POST",
      body: JSON.stringify({ customIssuer: "TestIssuer", customName: "__t9_post_201__" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.cardId).toBeDefined();
    expect(data.card.issuer).toBe("TestIssuer");
    expect(data.card.name).toBe("__t9_post_201__");
    trackedCardIds.push(data.cardId);
  });

  it("returns 409 on duplicate", async () => {
    // Seed a Card matching the catalog entry for "chase-sapphire-preferred"
    const card = await prisma.card.create({
      data: {
        issuer: "Chase",
        name: "Sapphire Preferred",
        scrapeUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
        defaultColor: "#1a56db",
      },
    });
    trackedCardIds.push(card.id);

    // Seed the UserCard directly — route will find this card and hit P2002
    await prisma.userCard.create({
      data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
    });

    // POST with same catalogCardId — findFirst matches the seeded Card → P2002
    const req = new NextRequest("http://localhost/api/user-cards", {
      method: "POST",
      body: JSON.stringify({ catalogCardId: "chase-sapphire-preferred" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("You already have this card");
  });
});

describe("DELETE /api/user-cards/[id]", () => {
  it("returns 403 for wrong userId", async () => {
    const card = await prisma.card.create({
      data: { issuer: "Citi", name: "__t9_403_card__", scrapeUrl: null, defaultColor: "#1e40af" },
    });
    trackedCardIds.push(card.id);

    const uc = await prisma.userCard.create({
      data: { userId: OTHER_USER, cardId: card.id, displayOrder: 0 },
    });

    const req = new NextRequest(`http://localhost/api/user-cards/${uc.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: uc.id }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("cascades to delete benefits and periods", async () => {
    const card = await prisma.card.create({
      data: { issuer: "Amex", name: "__t9_cascade_card__", scrapeUrl: null, defaultColor: "#B8952A" },
    });
    trackedCardIds.push(card.id);

    const userCard = await prisma.userCard.create({
      data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
    });
    const benefit = await prisma.benefit.create({
      data: {
        userCardId: userCard.id,
        name: "__t9_benefit__",
        type: "credit",
        value: 10,
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
      },
    });
    await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-04-30"),
        usedAmount: 0,
        status: "open",
      },
    });

    const req = new NextRequest(`http://localhost/api/user-cards/${userCard.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: userCard.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const remainingBenefit = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    const remainingPeriod = await prisma.benefitPeriod.findFirst({ where: { benefitId: benefit.id } });
    expect(remainingBenefit).toBeNull();
    expect(remainingPeriod).toBeNull();
  });
});
