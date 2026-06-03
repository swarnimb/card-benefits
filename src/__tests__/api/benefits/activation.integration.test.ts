import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t51_user__"),
}));

import { PATCH } from "@/app/api/benefits/[id]/activation/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t51_user__";
const OTHER_USER = "__t51_other_user__";

let testUserCardId: string;
let otherUserCardId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t51_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t51_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  testUserCardId = (
    await prisma.userCard.create({ data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 } })
  ).id;

  const otherCard = await prisma.card.create({
    data: { issuer: "Amex", name: "__t51_other_card__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  otherUserCardId = (
    await prisma.userCard.create({ data: { userId: OTHER_USER, cardId: otherCard.id, displayOrder: 0 } })
  ).id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t51_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: testUserCardId } });
  await prisma.benefit.deleteMany({ where: { userCardId: otherUserCardId } });
});

function createBenefit(userCardId: string, setAndForget: boolean) {
  return prisma.benefit.create({
    data: {
      userCardId,
      name: "Test Benefit",
      type: setAndForget ? "subscription" : "credit",
      value: 100,
      resetPeriod: "annual",
      resetAnchor: "calendar",
      category: "dining",
      classification: setAndForget ? "activation-perk" : "discretionary-credit",
      tracked: true,
      setAndForget,
    },
  });
}

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/benefits/${id}/activation`, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("PATCH /api/benefits/[id]/activation", () => {
  it("toggles activation on and off", async () => {
    const benefit = await createBenefit(testUserCardId, true);

    const onRes = await patch(benefit.id, { activated: true });
    expect(onRes.status).toBe(200);
    const onData = await onRes.json();
    expect(onData.activatedAt).not.toBeNull();

    const offRes = await patch(benefit.id, { activated: false });
    expect(offRes.status).toBe(200);
    const offData = await offRes.json();
    expect(offData.activatedAt).toBeNull();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("no session"));
    const benefit = await createBenefit(testUserCardId, true);

    const res = await patch(benefit.id, { activated: true });
    expect(res.status).toBe(401);
  });

  it("returns 400 when activated is not a boolean", async () => {
    const benefit = await createBenefit(testUserCardId, true);

    const res = await patch(benefit.id, { activated: "yes" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("activated must be true or false");
  });

  it("returns 409 when benefit is not set-and-forget", async () => {
    const benefit = await createBenefit(testUserCardId, false);

    const res = await patch(benefit.id, { activated: true });
    expect(res.status).toBe(409);
  });

  it("returns 403 for a benefit belonging to a different user", async () => {
    const otherBenefit = await createBenefit(otherUserCardId, true);

    const res = await patch(otherBenefit.id, { activated: true });
    expect(res.status).toBe(403);
  });
});
