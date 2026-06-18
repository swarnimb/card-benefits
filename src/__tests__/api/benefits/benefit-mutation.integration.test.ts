import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t12_user__"),
}));

import { PATCH, DELETE } from "@/app/api/benefits/[id]/route";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import { prisma } from "@/lib/db";

const TEST_USER = "__t12_user__";
const OTHER_USER = "__t12_other_user__";

let testUserCardId: string;
let otherUserCardId: string;

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t12_" } } });

  const card = await prisma.card.create({
    data: { issuer: "Chase", name: "__t12_card__", scrapeUrl: null, defaultColor: "#1a1a1a" },
  });
  const testUserCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });
  testUserCardId = testUserCard.id;

  const otherCard = await prisma.card.create({
    data: { issuer: "Amex", name: "__t12_other_card__", scrapeUrl: null, defaultColor: "#2a2a2a" },
  });
  const otherUserCard = await prisma.userCard.create({
    data: { userId: OTHER_USER, cardId: otherCard.id, displayOrder: 0 },
  });
  otherUserCardId = otherUserCard.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t12_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId: testUserCardId } });
  await prisma.benefit.deleteMany({ where: { userCardId: otherUserCardId } });
});

async function createBenefit(userCardId: string, overrides: Record<string, unknown> = {}) {
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
      ...overrides,
    },
  });
}

describe("PATCH /api/benefits/[id]", () => {
  it("updates name and returns updated benefit", async () => {
    const benefit = await createBenefit(testUserCardId);

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Name");
    expect(data.type).toBe("credit");
  });

  it("resets usedAmount to 0 when type changes", async () => {
    const benefit = await createBenefit(testUserCardId, { type: "credit" });
    await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        usedAmount: 50,
        status: "open",
      },
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ type: "subscription" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const period = await prisma.benefitPeriod.findFirst({
      where: { benefitId: benefit.id, status: "open" },
    });
    expect(period?.usedAmount).toBe(0);
  });

  it("changing resetPeriod annual→quarterly closes the stale open period (re-read yields a correctly-bounded new period)", async () => {
    const benefit = await createBenefit(testUserCardId, { resetPeriod: "annual" });
    const stale = await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        usedAmount: 40,
        status: "open",
      },
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ resetPeriod: "quarterly" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);

    // The stale annual period is closed in-place (open→closed, CONSTRAINT-08); usedAmount preserved as history.
    const staleAfter = await prisma.benefitPeriod.findUnique({ where: { id: stale.id } });
    expect(staleAfter?.status).toBe("closed");
    expect(staleAfter?.usedAmount).toBe(40);

    // No open period remains immediately after the edit.
    const openAfterEdit = await prisma.benefitPeriod.findFirst({
      where: { benefitId: benefit.id, status: "open" },
    });
    expect(openAfterEdit).toBeNull();

    // The next read (lazy ensureCurrentPeriod, CONSTRAINT-03) regenerates a quarter-bounded period.
    const regenerated = await ensureCurrentPeriod(benefit.id);
    expect(regenerated).not.toBeNull();
    expect(regenerated!.id).not.toBe(stale.id);
    expect(regenerated!.usedAmount).toBe(0);
    const spanDays =
      (regenerated!.periodEnd!.getTime() - regenerated!.periodStart.getTime()) / 86_400_000;
    expect(spanDays).toBeLessThan(120); // quarter (~91d), not the annual 365d
  });

  it("changing only value (same resetPeriod) does not close/regenerate the period", async () => {
    const benefit = await createBenefit(testUserCardId, { resetPeriod: "annual", value: 100 });
    const period = await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        usedAmount: 30,
        status: "open",
      },
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value: 250 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const after = await prisma.benefitPeriod.findUnique({ where: { id: period.id } });
    expect(after?.status).toBe("open"); // untouched
    expect(after?.usedAmount).toBe(30); // usage preserved
    const periodCount = await prisma.benefitPeriod.count({ where: { benefitId: benefit.id } });
    expect(periodCount).toBe(1); // nothing regenerated
  });

  it("resetPeriod change on a set-and-forget benefit creates/closes no period", async () => {
    const benefit = await createBenefit(testUserCardId, {
      resetPeriod: "annual",
      setAndForget: true,
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ resetPeriod: "monthly" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    expect((await res.json()).resetPeriod).toBe("monthly"); // edit applied
    const periodCount = await prisma.benefitPeriod.count({ where: { benefitId: benefit.id } });
    expect(periodCount).toBe(0); // CONSTRAINT-17: no periods ever touched
  });

  it("accepts tracked override but still strips classification and isTrackable", async () => {
    const benefit = await createBenefit(testUserCardId, {
      classification: "discretionary-credit",
      tracked: true,
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: "Renamed",
          tracked: false,
          classification: "auto-earn",
          isTrackable: false,
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const persisted = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(persisted!.name).toBe("Renamed"); // allowed field applied
    // Decision A (updated 2026-05-26): tracked is now user-editable post-save.
    expect(persisted!.tracked).toBe(false);
    // classification stays server-only — silently stripped.
    expect(persisted!.classification).toBe("discretionary-credit");
  });

  it("PATCH accepts tracked field and persists it", async () => {
    const benefit = await createBenefit(testUserCardId, {
      classification: "discretionary-credit",
      tracked: true,
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tracked: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const persisted = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(persisted!.tracked).toBe(false);
  });

  it("PATCH rejects non-boolean tracked with 400", async () => {
    const benefit = await createBenefit(testUserCardId);

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tracked: "yes" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("tracked must be true or false");
  });

  it("does not 400 when body has only stripped fields plus a valid field", async () => {
    const benefit = await createBenefit(testUserCardId);

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tracked: true,
          classification: "passive-perk",
          isTrackable: true,
          name: "Still Valid",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200); // silent strip, no 400 (existing contract)
    expect((await res.json()).name).toBe("Still Valid");
  });

  it("returns 403 for benefit belonging to different user", async () => {
    const otherBenefit = await createBenefit(otherUserCardId);

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${otherBenefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Should Not Update" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: otherBenefit.id }) }
    );

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/benefits/[id] — source edit-pin (Task 81)", () => {
  it('editing a scraped benefit flips source to "manual"', async () => {
    const benefit = await createBenefit(testUserCardId, { source: "scraped" });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Edited By User" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const persisted = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(persisted!.name).toBe("Edited By User");
    expect(persisted!.source).toBe("manual"); // edit-pin flip
  });

  it('editing an already-manual benefit leaves source "manual"; a body-supplied source/classification is ignored', async () => {
    // SEC: source/classification are never in ALLOWED_PATCH_FIELDS — a body value is stripped.
    const benefit = await createBenefit(testUserCardId, {
      source: "manual",
      classification: "discretionary-credit",
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed", source: "scraped", classification: "auto-earn" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    const persisted = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(persisted!.name).toBe("Renamed"); // allowed field applied
    expect(persisted!.source).toBe("manual"); // body "scraped" ignored, stays manual
    expect(persisted!.classification).toBe("discretionary-credit"); // body classification stripped
  });

  it("a frequency change still closes the open period and pins source in the same transaction", async () => {
    // Regression + atomicity: the resetPeriod-change period close AND the edit-pin flip are one transaction.
    const benefit = await createBenefit(testUserCardId, {
      source: "scraped",
      resetPeriod: "monthly",
      tracked: true,
    });
    const open = await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
        usedAmount: 10,
        status: "open",
      },
    });

    const res = await PATCH(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ resetPeriod: "quarterly" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);

    // Both effects of the single transaction:
    const openAfter = await prisma.benefitPeriod.findUnique({ where: { id: open.id } });
    expect(openAfter!.status).toBe("closed"); // period closed
    const persisted = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(persisted!.source).toBe("manual"); // source pinned in the same tx
  });
});

describe("DELETE /api/benefits/[id]", () => {
  it("removes benefit and all its periods", async () => {
    const benefit = await createBenefit(testUserCardId);
    await prisma.benefitPeriod.create({
      data: {
        benefitId: benefit.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        usedAmount: 0,
        status: "open",
      },
    });

    const res = await DELETE(
      new NextRequest(`http://localhost/api/benefits/${benefit.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: benefit.id }) }
    );

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const deletedBenefit = await prisma.benefit.findUnique({ where: { id: benefit.id } });
    expect(deletedBenefit).toBeNull();

    const orphanedPeriods = await prisma.benefitPeriod.findMany({ where: { benefitId: benefit.id } });
    expect(orphanedPeriods).toHaveLength(0);
  });

  it("returns 403 when deleting another user's benefit", async () => {
    const otherBenefit = await createBenefit(otherUserCardId);

    const res = await DELETE(
      new NextRequest(`http://localhost/api/benefits/${otherBenefit.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: otherBenefit.id }) }
    );

    expect(res.status).toBe(403);

    // The benefit must NOT have been deleted.
    const stillThere = await prisma.benefit.findUnique({ where: { id: otherBenefit.id } });
    expect(stillThere).not.toBeNull();
  });

  it("returns 404 when the benefit does not exist", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost/api/benefits/nonexistent-id", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nonexistent-id" }) }
    );

    expect(res.status).toBe(404);
  });
});
