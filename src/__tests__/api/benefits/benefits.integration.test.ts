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
            classification: "discretionary-credit",
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

  it("returns classification/tracked and null currentPeriod for tracked=false", async () => {
    await prisma.benefit.create({
      data: {
        userCardId: testUserCard.id,
        name: "Excluded Auto Earn",
        type: "perk",
        value: 5000,
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "shopping",
        classification: "auto-earn",
        tracked: false,
      },
    });

    const res = await GET(
      new NextRequest(`http://localhost/api/benefits/${testUserCard.id}`),
      { params: Promise.resolve({ id: testUserCard.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    const excluded = data.find((b: { name: string }) => b.name === "Excluded Auto Earn");
    expect(excluded).toBeDefined(); // excluded benefits still returned, never dropped
    expect(excluded.classification).toBe("auto-earn");
    expect(excluded.tracked).toBe(false);
    expect(excluded.currentPeriod).toBeNull(); // no ensureCurrentPeriod side-effect when untracked
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
        classification: "passive-perk",
        tracked: false,
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
            classification: "discretionary-credit",
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

  function confirmReq(benefits: unknown[]) {
    return new NextRequest("http://localhost/api/benefits/confirm", {
      method: "POST",
      body: JSON.stringify({ userCardId: testUserCard.id, benefits }),
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseBenefit = {
    name: "Sample Benefit",
    description: null,
    type: "credit",
    value: 100,
    resetPeriod: "annual",
    resetAnchor: "calendar",
    category: "travel",
    confidence: 0.9,
  };

  it("persists discretionary-credit with tracked=true and an open period", async () => {
    const res = await CONFIRM(
      confirmReq([{ ...baseBenefit, name: "Tracked Credit", classification: "discretionary-credit" }])
    );
    expect(res.status).toBe(200);

    const b = await prisma.benefit.findFirst({
      where: { userCardId: testUserCard.id, name: "Tracked Credit" },
    });
    expect(b!.classification).toBe("discretionary-credit");
    expect(b!.tracked).toBe(true);

    const period = await prisma.benefitPeriod.findFirst({ where: { benefitId: b!.id } });
    expect(period?.status).toBe("open");
  });

  it("persists auto-earn with tracked=false and no period", async () => {
    const res = await CONFIRM(
      confirmReq([{ ...baseBenefit, name: "Auto Earn Points", type: "perk", classification: "auto-earn" }])
    );
    expect(res.status).toBe(200);

    const b = await prisma.benefit.findFirst({
      where: { userCardId: testUserCard.id, name: "Auto Earn Points" },
    });
    expect(b).not.toBeNull(); // excluded benefits are persisted, never dropped
    expect(b!.classification).toBe("auto-earn");
    expect(b!.tracked).toBe(false);

    const period = await prisma.benefitPeriod.findFirst({ where: { benefitId: b!.id } });
    expect(period).toBeNull();
  });

  it("honors client tracked=true override even for auto-earn classification", async () => {
    const res = await CONFIRM(
      confirmReq([
        { ...baseBenefit, name: "User Override Track", type: "perk", classification: "auto-earn", tracked: true },
      ])
    );
    expect(res.status).toBe(200);

    const b = await prisma.benefit.findFirst({
      where: { userCardId: testUserCard.id, name: "User Override Track" },
    });
    // Decision A (updated 2026-05-26): client-supplied tracked WINS over deriveTracked.
    // Server only falls back to classification-derived value when client omits the field.
    expect(b!.tracked).toBe(true);

    // Override to tracked=true triggers initial open period creation.
    const period = await prisma.benefitPeriod.findFirst({ where: { benefitId: b!.id } });
    expect(period?.status).toBe("open");
  });

  it("falls back to deriveTracked when client omits tracked", async () => {
    // Payload intentionally omits `tracked`. Classification is auto-earn →
    // server deriveTracked returns false → persisted tracked must be false.
    const res = await CONFIRM(
      confirmReq([
        { ...baseBenefit, name: "Derive Default", type: "perk", classification: "auto-earn" },
      ])
    );
    expect(res.status).toBe(200);

    const b = await prisma.benefit.findFirst({
      where: { userCardId: testUserCard.id, name: "Derive Default" },
    });
    expect(b!.tracked).toBe(false);

    const period = await prisma.benefitPeriod.findFirst({ where: { benefitId: b!.id } });
    expect(period).toBeNull();
  });

  it("rejects non-boolean tracked with 400", async () => {
    const res = await CONFIRM(
      confirmReq([
        { ...baseBenefit, name: "Bad Tracked", classification: "discretionary-credit", tracked: "yes" },
      ])
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("tracked must be true or false");
  });

  it("returns 400 when classification is not in the allowlist", async () => {
    const res = await CONFIRM(
      confirmReq([{ ...baseBenefit, classification: "lifestyle" }])
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid value for field classification");
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
            classification: "discretionary-credit",
            confidence: 0.8,
          }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("invalid type");
  });

  // ---------------------------------------------------------------------------
  // Task 60 — annualFee persistence + confidence/note allowlist stripping.
  // ---------------------------------------------------------------------------

  function confirmReqWith(extra: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/benefits/confirm", {
      method: "POST",
      body: JSON.stringify({
        userCardId: testUserCard.id,
        benefits: [{ ...baseBenefit, name: "Task60 Benefit", classification: "discretionary-credit" }],
        ...extra,
      }),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("confirm persists annualFee to Card (happy path, CONSTRAINT-21)", async () => {
    const res = await CONFIRM(confirmReqWith({ annualFee: 550 }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // The fee is persisted on the shared Card row, not the UserCard.
    const uc = await prisma.userCard.findUnique({
      where: { id: testUserCard.id },
      include: { card: true },
    });
    expect(uc!.card.annualFee).toBe(550);

    // null is allowed and clears the fee (not all cards expose one / user blanked it).
    const res2 = await CONFIRM(confirmReqWith({ annualFee: null }));
    expect(res2.status).toBe(200);
    const uc2 = await prisma.userCard.findUnique({
      where: { id: testUserCard.id },
      include: { card: true },
    });
    expect(uc2!.card.annualFee).toBeNull();
  });

  it("rejects a negative annualFee with a LOUD 400 (SEC-02 / EH-01)", async () => {
    const res = await CONFIRM(confirmReqWith({ annualFee: -10 }));
    expect(res.status).toBe(400);
    const err = (await res.json()).error;
    expect(err).toContain("annualFee must be a non-negative number or null");
    expect(err).toContain("-10"); // error carries the bad value as context

    // Bad input must not have written any benefit row.
    const b = await prisma.benefit.findFirst({ where: { userCardId: testUserCard.id, name: "Task60 Benefit" } });
    expect(b).toBeNull();
  });

  it("confirm strips confidence/note; Benefit rows have neither (allowlist write)", async () => {
    const res = await CONFIRM(
      new NextRequest("http://localhost/api/benefits/confirm", {
        method: "POST",
        body: JSON.stringify({
          userCardId: testUserCard.id,
          benefits: [{
            name: "Allowlist Benefit",
            description: null,
            type: "credit",
            value: 100,
            resetPeriod: "annual",
            resetAnchor: "calendar",
            category: "travel",
            classification: "discretionary-credit",
            // Review-only fields a malicious/buggy client might send — must be
            // stripped server-side and never persisted to the Benefit table.
            confidence: "low",
            note: "this should never reach the DB",
          }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);

    const b = await prisma.benefit.findFirst({
      where: { userCardId: testUserCard.id, name: "Allowlist Benefit" },
    });
    expect(b).not.toBeNull();
    // The Benefit table has no confidence/note columns at all — prove the row
    // object that came back from Prisma carries neither key.
    expect(b).not.toHaveProperty("confidence");
    expect(b).not.toHaveProperty("note");

    // Defense-in-depth: query the raw SQLite row and assert no such columns hold data.
    const rawRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "Benefit" WHERE id = ${b!.id}
    `;
    expect(rawRows).toHaveLength(1);
    expect(rawRows[0]).not.toHaveProperty("confidence");
    expect(rawRows[0]).not.toHaveProperty("note");
  });
});
