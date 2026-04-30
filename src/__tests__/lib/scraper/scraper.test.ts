import { vi, describe, it, expect, beforeEach } from "vitest";

// Hoisted mocks — must be declared before vi.mock factories close over them
const { mockGoto, mockEvaluate, mockClose } = vi.hoisted(() => ({
  mockGoto: vi.fn(),
  mockEvaluate: vi.fn(),
  mockClose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("playwright", () => {
  class TimeoutError extends Error {
    constructor() {
      super("page.goto: Timeout 30000ms exceeded.");
      this.name = "TimeoutError";
    }
  }
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: mockGoto,
            evaluate: mockEvaluate,
          }),
        }),
        close: mockClose,
      }),
    },
    errors: { TimeoutError },
  };
});

import { genericScrape, ScraperError } from "@/lib/scraper/generic";
import { scrapeCard } from "@/lib/scraper/index";

const REALISTIC_PAGE_TEXT = "Credit Card Benefits and Rewards Summary — Your card includes dining credits, travel perks, and streaming subscriptions.";

describe("genericScrape", () => {
  beforeEach(() => {
    mockGoto.mockReset();
    mockEvaluate.mockReset();
    mockClose.mockReset().mockResolvedValue(undefined);
  });

  it("returns page text on successful navigation", async () => {
    mockGoto.mockResolvedValue(undefined);
    mockEvaluate.mockResolvedValue(REALISTIC_PAGE_TEXT);

    const result = await genericScrape("https://example.com/benefits");
    expect(result).toBe(REALISTIC_PAGE_TEXT);
    expect(mockClose).toHaveBeenCalled();
  });

  it("throws ScraperError with url and reason on navigation failure", async () => {
    mockGoto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));

    const url = "https://example.com/benefits";
    let caught: unknown;
    try {
      await genericScrape(url);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ScraperError);
    expect((caught as ScraperError).url).toBe(url);
    expect((caught as ScraperError).reason).toContain("ERR_NAME_NOT_RESOLVED");
    expect(mockClose).toHaveBeenCalled(); // browser closed even on error
  });
});

describe("scrapeCard", () => {
  beforeEach(() => {
    mockGoto.mockResolvedValue(undefined);
    mockEvaluate.mockResolvedValue(REALISTIC_PAGE_TEXT);
    mockClose.mockResolvedValue(undefined);
  });

  it("dispatches to issuer-specific scraper for known issuer", async () => {
    const result = await scrapeCard("Chase", "https://chase.com/benefits");
    expect(result).toBe(REALISTIC_PAGE_TEXT);
    expect(mockGoto).toHaveBeenCalledWith(
      "https://chase.com/benefits",
      expect.objectContaining({ waitUntil: "networkidle" })
    );
  });

  it("falls back to genericScrape for unknown issuer", async () => {
    const result = await scrapeCard("Unknown Bank", "https://unknown.com/benefits");
    expect(result).toBe(REALISTIC_PAGE_TEXT);
    expect(mockGoto).toHaveBeenCalledWith(
      "https://unknown.com/benefits",
      expect.objectContaining({ waitUntil: "networkidle" })
    );
  });

  it("propagates ScraperError when the underlying scraper throws", async () => {
    mockGoto.mockRejectedValue(new Error("net::ERR_CONNECTION_REFUSED"));
    await expect(scrapeCard("Chase", "https://chase.com/benefits")).rejects.toBeInstanceOf(ScraperError);
  });
});
