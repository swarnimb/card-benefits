import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t82_user__"),
}));

import { POST } from "@/app/api/benefits/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t82_user__";
const OTHER_USER = "__t82_other_user__";

let testUserCardId: string;
let otherUserCardId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t82_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t82_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  const testUserCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });
  testUserCardId = testUserCard.id;

  const otherCard = await prisma.card.create({
    data: { issuer: "Amex", name: "__t82_other_card__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  const otherUserCard = await prisma.userCard.create({
    data: { userId: OTHER_USER, cardId: otherCard.id, displayOrder: 0 },
  });
  otherUserCardId = otherUserCard.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t82_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: testUserCardId } });
  await prisma.benefit.deleteMany({ where: { userCardId: otherUserCardId } });
});

function createRequest(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/benefits", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("POST /api/benefits — manual create (Task 82)", () => {
  it("creates one manual tracked benefit with an open period for a monthly credit", async () => {
    const res = await createRequest({
      userCardId: testUserCardId,
      name: "Manual Dining Credit",
      value: 50,
      resetPeriod: "monthly",
      type: "credit",
      category: "dining",
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.source).toBe("manual");
    expect(data.tracked).toBe(true);
    expect(data.setAndForget).toBe(false);
    expect(data.resetAnchor).toBe("calendar");
    expect(data.valueUnit).toBe("dollars");
    expect(data.classification).toBe("discretionary-credit");
    expect(data.currentPeriod).not.toBeNull();
    expect(data.currentPeriod.status).toBe("open");

    // Exactly ONE Benefit row created for this userCard.
    const rows = await prisma.benefit.findMany({ where: { userCardId: testUserCardId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(data.id);
  });

  it('resetPeriod "once" creates the benefit with no rolling period', async () => {
    const res = await createRequest({
      userCardId: testUserCardId,
      name: "Manual One-Time Credit",
      value: 300,
      resetPeriod: "once",
      type: "credit",
      category: "travel",
    });

    expect(res.status).toBe(201);
    const data = await res.json();

    // A once-benefit is tracked + non-set-and-forget, so createBenefitWithPeriod
    // still creates its initial period — but with resetPeriod "once" the boundary
    // is { periodStart: now, periodEnd: null }, i.e. a single perpetual open period
    // that NEVER rolls (ensureCurrentPeriod treats periodEnd:null as non-expiring).
    // "No rolling period" = exactly one open period whose periodEnd is null.
    const periods = await prisma.benefitPeriod.findMany({ where: { benefitId: data.id } });
    expect(periods).toHaveLength(1);
    expect(periods[0].status).toBe("open");
    expect(periods[0].periodEnd).toBeNull(); // non-rolling: no end date, never rolls over
  });

  it("rejects a body-supplied classification/source/tracked override; returns 403 for another user's userCard", async () => {
    // (a) Overrides in the body are ignored — server pins manual/tracked/discretionary-credit.
    const resA = await createRequest({
      userCardId: testUserCardId,
      name: "Override Attempt",
      value: 25,
      resetPeriod: "monthly",
      type: "credit",
      category: "dining",
      classification: "auto-earn",
      source: "scraped",
      tracked: false,
    });
    expect(resA.status).toBe(201);
    const dataA = await resA.json();
    const persisted = await prisma.benefit.findUnique({ where: { id: dataA.id } });
    expect(persisted!.source).toBe("manual");
    expect(persisted!.tracked).toBe(true);
    expect(persisted!.classification).toBe("discretionary-credit");

    // (b) Another user's userCard → 403.
    const resB = await createRequest({
      userCardId: otherUserCardId,
      name: "Cross-User Attempt",
      value: 10,
      resetPeriod: "monthly",
      type: "credit",
      category: "dining",
    });
    expect(resB.status).toBe(403);
  });

  it("invalid resetPeriod/type/category returns 400", async () => {
    const res = await createRequest({
      userCardId: testUserCardId,
      name: "Bad Reset Period",
      value: 50,
      resetPeriod: "weekly", // invalid
      type: "credit",
      category: "dining",
    });

    expect(res.status).toBe(400);
    const rows = await prisma.benefit.findMany({ where: { userCardId: testUserCardId } });
    expect(rows).toHaveLength(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("no session"));

    const res = await createRequest({
      userCardId: testUserCardId,
      name: "Should Not Create",
      value: 50,
      resetPeriod: "monthly",
      type: "credit",
      category: "dining",
    });

    expect(res.status).toBe(401);
    const rows = await prisma.benefit.findMany({ where: { userCardId: testUserCardId } });
    expect(rows).toHaveLength(0);
  });

  it("returns 400 when the body is not an object", async () => {
    const res = await createRequest([]);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request body");
    const rows = await prisma.benefit.findMany({ where: { userCardId: testUserCardId } });
    expect(rows).toHaveLength(0);
  });
});
