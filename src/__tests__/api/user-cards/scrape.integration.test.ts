import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAuth, mockScrapeCard, mockParseBenefits } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockScrapeCard: vi.fn(),
  mockParseBenefits: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  getUserId: vi.fn().mockReturnValue("__t10_user__"),
}));

vi.mock("@/lib/scraper", () => ({
  scrapeCard: mockScrapeCard,
}));

// Task 45: route.ts does `err instanceof ParserError` (line 49). A plain `() => ({ parseBenefits })`
// mock replaces the whole module — `ParserError` becomes undefined and `instanceof` against
// undefined throws TypeError. Use `vi.importActual` to keep the real ParserError class while
// stubbing `parseBenefits`. Latent gap pre-Task-45; no existing test hit the parseBenefits-throws
// branch, so it never surfaced.
vi.mock("@/lib/parser", async () => {
  const actual = await vi.importActual<typeof import("@/lib/parser")>("@/lib/parser");
  return {
    parseBenefits: mockParseBenefits,
    ParserError: actual.ParserError,
  };
});

import { POST } from "@/app/api/user-cards/[id]/scrape/route";
import { ScraperError } from "@/lib/scraper/generic";
import { ParserError } from "@/lib/parser";
import { prisma } from "@/lib/db";

const TEST_USER = "__t10_user__";
let userCardWithUrl: { id: string };
let userCardNoUrl: { id: string };

beforeAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t10_" } } });

  const cardWithUrl = await prisma.card.create({
    data: {
      issuer: "Chase",
      name: "__t10_card_with_url__",
      scrapeUrl: "https://example.com/benefits",
      defaultColor: "#1a1a1a",
    },
  });
  userCardWithUrl = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: cardWithUrl.id, displayOrder: 0 },
  });

  const cardNoUrl = await prisma.card.create({
    data: {
      issuer: "Custom",
      name: "__t10_card_no_url__",
      scrapeUrl: null,
      defaultColor: "#64748b",
    },
  });
  userCardNoUrl = await prisma.userCard.create({
    data: { userId: TEST_USER, cardId: cardNoUrl.id, displayOrder: 1 },
  });
});

afterAll(async () => {
  await prisma.userCard.deleteMany({ where: { userId: TEST_USER } });
  await prisma.card.deleteMany({ where: { name: { startsWith: "__t10_" } } });
});

beforeEach(() => {
  mockRequireAuth.mockResolvedValue({ user: { id: TEST_USER }, expires: "2099-01-01" });
  mockScrapeCard.mockReset();
  mockParseBenefits.mockReset();
});

describe("POST /api/user-cards/[id]/scrape", () => {
  it("returns draft benefits on success", async () => {
    const draft = {
      name: "Dining Credit",
      description: null,
      type: "credit" as const,
      value: 120,
      resetPeriod: "annual" as const,
      resetAnchor: "calendar" as const,
      category: "dining" as const,
      classification: "discretionary-credit",
      tracked: true,
      confidence: 0.95,
    };
    mockScrapeCard.mockResolvedValue("raw page text");
    mockParseBenefits.mockResolvedValue({ benefits: [draft], annualFee: null });

    const req = new NextRequest(
      `http://localhost/api/user-cards/${userCardWithUrl.id}/scrape`,
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ id: userCardWithUrl.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.benefits).toHaveLength(1);
    expect(data.benefits[0].name).toBe("Dining Credit");
    expect(data.scrapeError).toBeUndefined();
  });

  it("returns scrapeError when ScraperError is thrown", async () => {
    mockScrapeCard.mockRejectedValue(
      new ScraperError({ url: "https://example.com/benefits", issuer: "Chase", reason: "timeout" })
    );

    const req = new NextRequest(
      `http://localhost/api/user-cards/${userCardWithUrl.id}/scrape`,
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ id: userCardWithUrl.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.benefits).toEqual([]);
    expect(data.scrapeError).toContain("timeout");
  });

  it("returns parseError when ParserError is thrown (e.g. Haiku max_tokens overflow)", async () => {
    // Task 45 (NEW-4): premium cards (Sapphire Reserve confirmed) hit max_tokens; parser
    // throws ParserError with user-actionable message; route should surface it as parseError
    // in the response body (separate field from scrapeError, per route.ts line 50).
    mockScrapeCard.mockResolvedValue("raw page text exceeding token budget");
    mockParseBenefits.mockRejectedValue(
      new ParserError({
        message: "Card content exceeds parser capacity, manual entry required",
        rawTextPreview: "raw page text exceeding token budget",
      })
    );

    const req = new NextRequest(
      `http://localhost/api/user-cards/${userCardWithUrl.id}/scrape`,
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ id: userCardWithUrl.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.benefits).toEqual([]);
    expect(data.parseError).toBe("Card content exceeds parser capacity, manual entry required");
  });

  it("returns scrapeError when scrapeUrl is null", async () => {
    const req = new NextRequest(
      `http://localhost/api/user-cards/${userCardNoUrl.id}/scrape`,
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ id: userCardNoUrl.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.benefits).toEqual([]);
    expect(data.scrapeError).toBe("Custom card — no scrape URL. Add benefits manually.");
  });
});
