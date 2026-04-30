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

vi.mock("@/lib/parser", () => ({
  parseBenefits: mockParseBenefits,
}));

import { POST } from "@/app/api/user-cards/[id]/scrape/route";
import { ScraperError } from "@/lib/scraper/generic";
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
      isTrackable: true,
      confidence: 0.95,
    };
    mockScrapeCard.mockResolvedValue("raw page text");
    mockParseBenefits.mockResolvedValue([draft]);

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
