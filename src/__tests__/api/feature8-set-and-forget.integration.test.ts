import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth } = vi.hoisted(() => ({ mockRequireAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t55_user__"),
}));

import { POST as CONFIRM_BENEFITS } from "@/app/api/benefits/confirm/route";
import { GET as GET_BENEFITS } from "@/app/api/user-cards/[id]/benefits/route";
import { PATCH as ACTIVATE } from "@/app/api/benefits/[id]/activation/route";
import { GET as GET_OVERVIEW } from "@/app/api/overview/route";
import { prisma } from "@/lib/db";

const TEST_USER = "__t55_user__";

let userCardId = "";

function post(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function patch(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** A membership-reimbursement draft (deriveSetAndForget → true via the real confirm route). */
function safDraft(name: string, classification = "activation-perk") {
  return {
    name, description: null, type: "subscription", value: 98,
    resetPeriod: "annual", resetAnchor: "calendar", category: "shopping",
    classification, tracked: true,
  };
}

/** A normal discretionary credit draft (setAndForget → false). */
function creditDraft(name: string) {
  return {
    name, description: null, type: "credit", value: 50,
    resetPeriod: "monthly", resetAnchor: "calendar", category: "dining",
    classification: "discretionary-credit", tracked: true,
  };
}

async function getBenefits() {
  const res = await GET_BENEFITS(
    new NextRequest(`http://localhost/api/user-cards/${userCardId}/benefits`),
    { params: Promise.resolve({ id: userCardId }) }
  );
  return res.json();
}

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t55_" } } });
  const card = await prisma.card.create({
    data: { issuer: "Amex", name: "__t55_Platinum", scrapeUrl: null, defaultColor: "#C9A84C" },
  });
  const userCard = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: card.id, displayOrder: 0 },
  });
  userCardId = userCard.id;
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t55_" } } });
});

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  await prisma.benefit.deleteMany({ where: { userCardId } });
});

describe("Feature 8: set-and-forget end-to-end", () => {
  it("classify → confirm → activate → Overview shows it as done, Cards shows it activated", async () => {
    // Confirm: one set-and-forget membership + one normal credit.
    const confirmRes = await CONFIRM_BENEFITS(
      post("/api/benefits/confirm", {
        userCardId,
        benefits: [safDraft("Walmart+ membership"), creditDraft("Dining Credit")],
      })
    );
    expect(confirmRes.status).toBe(200);

    // The confirm route derived setAndForget=true for Walmart+, and (CONSTRAINT-17)
    // gave it no BenefitPeriod; the normal credit got one.
    let benefits = await getBenefits();
    const saf = benefits.find((b: { name: string }) => b.name === "Walmart+ membership");
    const credit = benefits.find((b: { name: string }) => b.name === "Dining Credit");
    expect(saf.setAndForget).toBe(true);
    expect(saf.activatedAt).toBeNull();
    expect(saf.currentPeriod).toBeNull();
    expect(credit.setAndForget).toBe(false);
    expect(credit.currentPeriod).not.toBeNull();

    // Activate the set-and-forget benefit via the activation route.
    const actRes = await ACTIVATE(
      patch(`/api/benefits/${saf.id}/activation`, { activated: true }),
      { params: Promise.resolve({ id: saf.id }) }
    );
    expect(actRes.status).toBe(200);

    // Cards space: the benefit now reads as activated.
    benefits = await getBenefits();
    const safActivated = benefits.find((b: { name: string }) => b.name === "Walmart+ membership");
    expect(safActivated.activatedAt).not.toBeNull();

    // Overview: active set-and-forget is realized (done bucket), never needsAttention,
    // and contributes nothing to money-at-risk.
    const overviewRes = await GET_OVERVIEW(new NextRequest("http://localhost/api/overview"));
    expect(overviewRes.status).toBe(200);
    const overview = await overviewRes.json();

    const inNeedsAttention = overview.needsAttention.some((r: { benefitName: string }) => r.benefitName === "Walmart+ membership");
    const doneRow = overview.done.find((r: { benefitName: string }) => r.benefitName === "Walmart+ membership");
    expect(inNeedsAttention).toBe(false);
    expect(doneRow).toBeDefined(); // realized → done bucket
    expect(doneRow.unusedAmount).toBe(0); // nothing at risk

    // The normal monthly credit (resets ~end of month) is calm/non-urgent → onTrack.
    const creditRow = overview.onTrack.find((r: { benefitName: string }) => r.benefitName === "Dining Credit");
    expect(creditRow.unusedAmount).toBe(50);

    // money-at-risk excludes the membership entirely — its $98 value is never counted
    // (nothing is expiring-soon here, so the total is 0; the membership cannot inflate it).
    expect(overview.moneyAtRisk.totalUnredeemed).toBe(0);
  });

  it("classification spot-check: Uber One → set-and-forget, Uber Cash → not", async () => {
    const res = await CONFIRM_BENEFITS(
      post("/api/benefits/confirm", {
        userCardId,
        benefits: [safDraft("Uber One"), safDraft("Uber Cash")],
      })
    );
    expect(res.status).toBe(200);

    const benefits = await getBenefits();
    const uberOne = benefits.find((b: { name: string }) => b.name === "Uber One");
    const uberCash = benefits.find((b: { name: string }) => b.name === "Uber Cash");
    expect(uberOne.setAndForget).toBe(true);
    expect(uberCash.setAndForget).toBe(false);
  });

  it("re-scrape resets activation (documents the accepted CONSTRAINT-06 trade-off)", async () => {
    // Confirm + activate.
    await CONFIRM_BENEFITS(
      post("/api/benefits/confirm", { userCardId, benefits: [safDraft("CLEAR Plus")] })
    );
    let benefits = await getBenefits();
    const before = benefits.find((b: { name: string }) => b.name === "CLEAR Plus");
    await ACTIVATE(
      patch(`/api/benefits/${before.id}/activation`, { activated: true }),
      { params: Promise.resolve({ id: before.id }) }
    );
    benefits = await getBenefits();
    expect(benefits.find((b: { name: string }) => b.name === "CLEAR Plus").activatedAt).not.toBeNull();

    // Re-scrape = re-confirm: replaces ALL benefits (CONSTRAINT-06). The new row is
    // a fresh record with a new id and activatedAt reset to null.
    await CONFIRM_BENEFITS(
      post("/api/benefits/confirm", { userCardId, benefits: [safDraft("CLEAR Plus")] })
    );
    benefits = await getBenefits();
    const after = benefits.find((b: { name: string }) => b.name === "CLEAR Plus");
    expect(after.id).not.toBe(before.id); // replaced, not merged
    expect(after.setAndForget).toBe(true);
    expect(after.activatedAt).toBeNull(); // activation lost on re-scrape
  });
});
