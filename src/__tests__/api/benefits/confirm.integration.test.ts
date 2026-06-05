import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t66_user__"),
}));

import { POST as CONFIRM } from "@/app/api/benefits/confirm/route";
import { GET as GET_USER_CARDS } from "@/app/api/user-cards/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t66_user__";

let userCardId: string;
let cardId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t66_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t66_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  cardId = card.id;
  const userCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });
  userCardId = userCard.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t66_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId } });
});

/** A single valid draft benefit — the minimum the confirm validator accepts. */
function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    name: "Dining Credit",
    description: null,
    type: "credit",
    value: 120,
    valueUnit: "dollars",
    resetPeriod: "annual",
    resetAnchor: "calendar",
    category: "dining",
    classification: "discretionary-credit",
    tracked: true,
    setAndForget: false,
    ...overrides,
  };
}

function confirmRequest(body: unknown) {
  return CONFIRM(
    new NextRequest("http://localhost/api/benefits/confirm", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function getUserCardsJson() {
  const res = await GET_USER_CARDS(new NextRequest("http://localhost/api/user-cards"));
  expect(res.status).toBe(200);
  return res.json();
}

describe("POST /api/benefits/confirm — annualFee end-to-end (Task 66)", () => {
  it("persists annualFee to Card and GET /api/user-cards surfaces it", async () => {
    const res = await confirmRequest({
      userCardId,
      benefits: [makeDraft()],
      annualFee: 550,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // DB is the source of truth — assert the shared Card row carries the fee.
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    expect(card?.annualFee).toBe(550);

    // The display source: GET /api/user-cards must echo the same fee.
    const cards = await getUserCardsJson();
    const row = cards.find((uc: { id: string }) => uc.id === userCardId);
    expect(row).toBeDefined();
    expect(row.card.annualFee).toBe(550);
  });

  it("confirm with annualFee: null persists null (the '—' display source)", async () => {
    // Seed a non-null fee first so we can prove null overwrites it.
    await prisma.card.update({ where: { id: cardId }, data: { annualFee: 695 } });

    const res = await confirmRequest({
      userCardId,
      benefits: [makeDraft()],
      annualFee: null,
    });
    expect(res.status).toBe(200);

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    expect(card?.annualFee).toBeNull();

    const cards = await getUserCardsJson();
    const row = cards.find((uc: { id: string }) => uc.id === userCardId);
    expect(row.card.annualFee).toBeNull();
  });
});

describe("POST /api/benefits/confirm — confidence/note never persisted (Task 66 security)", () => {
  it("strips review-only confidence/note from the persisted Benefit rows", async () => {
    const res = await confirmRequest({
      userCardId,
      benefits: [
        makeDraft({
          name: "Travel Credit",
          // Review-only fields a client could supply — must NOT reach the DB.
          confidence: "low",
          note: "Haiku was unsure about the reset cadence",
        }),
      ],
      annualFee: 100,
    });
    expect(res.status).toBe(200);

    // Query the raw persisted row. confidence/note are not Prisma columns, so a
    // successful write that includes only allowlisted fields proves the strip.
    const rows = await prisma.benefit.findMany({ where: { userCardId } });
    expect(rows).toHaveLength(1);

    const row = rows[0] as Record<string, unknown>;
    expect(row.name).toBe("Travel Credit");
    // Defense-in-depth: the row object must not carry the review-only keys.
    expect("confidence" in row).toBe(false);
    expect("note" in row).toBe(false);

    // The persisted shape is exactly the allowlisted column set (no leakage).
    expect(Object.keys(row).sort()).toEqual(
      [
        "id",
        "userCardId",
        "name",
        "description",
        "type",
        "value",
        "valueUnit",
        "resetPeriod",
        "resetAnchor",
        "category",
        "classification",
        "tracked",
        "setAndForget",
        "activatedAt",
        "createdAt",
      ].sort()
    );
  });
});
