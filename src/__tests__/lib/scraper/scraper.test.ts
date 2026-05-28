import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before vi.mock factories close over them.
// ---------------------------------------------------------------------------
const {
  mockLaunch,
  mockGoto,
  mockEvaluate,
  mockContent,
  mockLocator,
  mockClose,
  mockReadabilityParse,
  mockFetch,
} = vi.hoisted(() => ({
  mockLaunch: vi.fn(),
  mockGoto: vi.fn(),
  mockEvaluate: vi.fn(),
  mockContent: vi.fn(),
  mockLocator: vi.fn(),
  mockClose: vi.fn().mockResolvedValue(undefined),
  mockReadabilityParse: vi.fn(),
  mockFetch: vi.fn(),
}));

// Playwright: produces a chromium.launch() chain that returns a fully-stubbed page.
vi.mock("playwright", () => {
  return {
    chromium: {
      launch: mockLaunch,
    },
  };
});

// jsdom: a minimal pass-through — Readability is what we actually assert on.
vi.mock("jsdom", () => {
  class JSDOM {
    window: { document: object };
    constructor(_html: string, _opts?: unknown) {
      this.window = { document: {} };
    }
  }
  return { JSDOM };
});

// @mozilla/readability: a constructor whose .parse() defers to the hoisted mock.
vi.mock("@mozilla/readability", () => {
  class Readability {
    parse() {
      return mockReadabilityParse();
    }
  }
  return { Readability };
});

// Stub global fetch as a vi mock function we can drive per-test.
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

// ---------------------------------------------------------------------------
// Default mock wiring helpers.
// ---------------------------------------------------------------------------

/** Wire up a fresh chromium.launch() result graph. Override props per-test as needed. */
function wirePlaywright(overrides: {
  gotoImpl?: typeof mockGoto;
  contentImpl?: typeof mockContent;
  evaluateImpl?: typeof mockEvaluate;
  locatorImpl?: typeof mockLocator;
} = {}) {
  mockGoto.mockReset();
  mockEvaluate.mockReset();
  mockContent.mockReset();
  mockLocator.mockReset();
  mockClose.mockReset().mockResolvedValue(undefined);

  if (overrides.gotoImpl) mockGoto.mockImplementation(overrides.gotoImpl);
  else mockGoto.mockResolvedValue(undefined);

  if (overrides.contentImpl) mockContent.mockImplementation(overrides.contentImpl);
  else mockContent.mockResolvedValue("<html><body>fallback</body></html>");

  if (overrides.evaluateImpl) mockEvaluate.mockImplementation(overrides.evaluateImpl);
  else mockEvaluate.mockResolvedValue("");

  // Default locator: returns an object whose .all() yields no handles.
  const defaultLocator = overrides.locatorImpl ?? (() => ({ all: async () => [] }));
  mockLocator.mockImplementation(defaultLocator as never);

  mockLaunch.mockReset().mockResolvedValue({
    newContext: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: mockGoto,
        evaluate: mockEvaluate,
        content: mockContent,
        locator: mockLocator,
      }),
    }),
    close: mockClose,
  });
}

/** Convenience: return a fetch Response-like with status 200 and given body. */
function ok(body: string) {
  return {
    ok: true,
    text: async () => body,
  } as unknown as Response;
}

// Long string so fast-path readability passes its >=1500-char gate.
const LONG_TEXT = "Credit card benefits and rewards summary. ".repeat(60);

// ---------------------------------------------------------------------------
// Module-under-test imports (after vi.mock blocks above).
// ---------------------------------------------------------------------------
import { genericScrape, ScraperError } from "@/lib/scraper/generic";
import { scrapeCard } from "@/lib/scraper/index";

// ---------------------------------------------------------------------------
// genericScrape
// ---------------------------------------------------------------------------

describe("genericScrape", () => {
  beforeEach(() => {
    wirePlaywright();
    mockReadabilityParse.mockReset();
    mockFetch.mockReset();
  });

  it("HTTP fast-path returns Readability-extracted text without launching Playwright", async () => {
    mockFetch.mockResolvedValue(ok("<html><body>plenty</body></html>"));
    mockReadabilityParse.mockReturnValue({ textContent: LONG_TEXT });

    const result = await genericScrape("https://example.com/benefits");
    expect(result).toBe(LONG_TEXT.trim());
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it("falls back to Playwright when HTTP response is too short", async () => {
    // Fast path: returns text but under 1500 chars.
    // Playwright path: returns long text via Readability on page.content().
    mockFetch.mockResolvedValue(ok("<html><body>short</body></html>"));
    mockReadabilityParse
      .mockReturnValueOnce({ textContent: "too short" }) // fast path
      .mockReturnValueOnce({ textContent: LONG_TEXT }); // playwright path

    const result = await genericScrape("https://example.com/benefits");
    expect(mockLaunch).toHaveBeenCalled();
    expect(result).toBe(LONG_TEXT.trim());
  });

  it("falls back to Playwright when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("ENOTFOUND"));
    mockReadabilityParse.mockReturnValue({ textContent: LONG_TEXT });

    const result = await genericScrape("https://example.com/benefits");
    expect(mockLaunch).toHaveBeenCalled();
    expect(result).toBe(LONG_TEXT.trim());
  });

  it("tolerates networkidle timeout and returns content from page.content()", async () => {
    mockFetch.mockRejectedValue(new Error("fail fast path"));
    const timeoutErr = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    wirePlaywright({
      gotoImpl: vi.fn().mockRejectedValue(timeoutErr),
      contentImpl: vi.fn().mockResolvedValue("<html><body>fully rendered</body></html>"),
    });
    mockReadabilityParse.mockReturnValue({ textContent: LONG_TEXT });

    const result = await genericScrape("https://example.com/benefits");
    expect(result).toBe(LONG_TEXT.trim());
    expect(mockClose).toHaveBeenCalled();
  });

  it("tolerates page.evaluate failure during scroll and still extracts from page.content() (eval-locked pages, e.g. Amex)", async () => {
    // Fast path under threshold forces the Playwright fallback.
    mockFetch.mockResolvedValue(ok("<html><body>short</body></html>"));
    // Amex disables eval, so page.evaluate (scroll + the innerText fallback) rejects.
    wirePlaywright({
      contentImpl: vi.fn().mockResolvedValue("<html><body>rendered benefits</body></html>"),
      evaluateImpl: vi.fn().mockRejectedValue(new Error("eval is disabled")),
    });
    mockReadabilityParse
      .mockReturnValueOnce({ textContent: "too short" }) // fast path < 1500
      .mockReturnValueOnce({ textContent: LONG_TEXT }); // playwright page.content()

    const result = await genericScrape("https://example.com/benefits");
    expect(result).toBe(LONG_TEXT.trim());
    expect(mockClose).toHaveBeenCalled();
  });

  it("calls expansion clicks for matching elements", async () => {
    mockFetch.mockRejectedValue(new Error("fail fast path"));

    // Three stubs for the [aria-expanded="false"] selector, all clickable.
    const ariaStubs = [
      { click: vi.fn().mockResolvedValue(undefined), textContent: vi.fn().mockResolvedValue("") },
      { click: vi.fn().mockResolvedValue(undefined), textContent: vi.fn().mockResolvedValue("") },
      { click: vi.fn().mockResolvedValue(undefined), textContent: vi.fn().mockResolvedValue("") },
    ];

    // One <summary> stub.
    const summaryStubs = [
      { click: vi.fn().mockResolvedValue(undefined), textContent: vi.fn().mockResolvedValue("") },
    ];

    // Two button-ish stubs with text matching the regex.
    const buttonStubs = [
      {
        click: vi.fn().mockResolvedValue(undefined),
        textContent: vi.fn().mockResolvedValue("Show more"),
      },
      {
        click: vi.fn().mockResolvedValue(undefined),
        textContent: vi.fn().mockResolvedValue("See details"),
      },
    ];

    wirePlaywright({
      locatorImpl: vi.fn((selector: string) => {
        if (selector === '[aria-expanded="false"]') return { all: async () => ariaStubs };
        if (selector === "details:not([open]) > summary") return { all: async () => summaryStubs };
        if (selector === 'button:visible, a[role="button"]:visible')
          return { all: async () => buttonStubs };
        return { all: async () => [] };
      }) as never,
    });
    mockReadabilityParse.mockReturnValue({ textContent: LONG_TEXT });

    await genericScrape("https://example.com/benefits");

    for (const s of ariaStubs) expect(s.click).toHaveBeenCalled();
    for (const s of summaryStubs) expect(s.click).toHaveBeenCalled();
    for (const s of buttonStubs) expect(s.click).toHaveBeenCalled();
  });

  it("throws ScraperError with reason=\"empty_content\" when both paths yield < 200 chars", async () => {
    mockFetch.mockResolvedValue(ok("<html></html>"));
    // Fast path: empty. Playwright path Readability: empty. innerText: empty.
    mockReadabilityParse
      .mockReturnValueOnce({ textContent: "" }) // fast path
      .mockReturnValueOnce({ textContent: "" }); // playwright path
    wirePlaywright({
      evaluateImpl: vi.fn().mockResolvedValue(""), // body.innerText also empty
    });

    let caught: unknown;
    try {
      await genericScrape("https://example.com/benefits", "test-issuer");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ScraperError);
    expect((caught as ScraperError).reason).toBe("empty_content");
  });

  it("throws ScraperError with {url, issuer, reason} on navigation failure", async () => {
    mockFetch.mockRejectedValue(new Error("fail fast path"));
    const navErr = new Error("net::ERR_NAME_NOT_RESOLVED");
    wirePlaywright({
      gotoImpl: vi.fn().mockRejectedValue(navErr),
    });

    const url = "https://example.com/benefits";
    let caught: unknown;
    try {
      await genericScrape(url, "Chase");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ScraperError);
    expect((caught as ScraperError).url).toBe(url);
    expect((caught as ScraperError).issuer).toBe("Chase");
    expect((caught as ScraperError).reason).toContain("ERR_NAME_NOT_RESOLVED");
    expect(mockClose).toHaveBeenCalled(); // browser closed even on error
  });
});

// ---------------------------------------------------------------------------
// scrapeCard
// ---------------------------------------------------------------------------

describe("scrapeCard", () => {
  beforeEach(() => {
    wirePlaywright();
    mockReadabilityParse.mockReset();
    mockFetch.mockReset();
    // Default: fast path satisfies everything, so genericScrape returns quickly.
    mockFetch.mockResolvedValue(ok("<html><body>ok</body></html>"));
    mockReadabilityParse.mockReturnValue({ textContent: LONG_TEXT });
  });

  it("routes every known issuer through genericScrape today", async () => {
    const issuers = ["Chase", "Amex", "Capital One", "Citi", "Discover", "Wells Fargo"];
    for (const issuer of issuers) {
      mockFetch.mockClear();
      const result = await scrapeCard(issuer, "http://x");
      expect(result).toBe(LONG_TEXT.trim());
      // genericScrape always hits fetch first — proves we routed through it.
      expect(mockFetch).toHaveBeenCalledWith("http://x", expect.any(Object));
    }
  });

  it("falls back to genericScrape for unknown issuer", async () => {
    const result = await scrapeCard("Definitely Unknown Bank", "http://x");
    expect(result).toBe(LONG_TEXT.trim());
    expect(mockFetch).toHaveBeenCalledWith("http://x", expect.any(Object));
  });

  it("propagates ScraperError when the underlying scraper throws", async () => {
    // Force both paths to fail so genericScrape throws a ScraperError.
    mockFetch.mockRejectedValue(new Error("fail fast path"));
    const navErr = new Error("net::ERR_CONNECTION_REFUSED");
    wirePlaywright({
      gotoImpl: vi.fn().mockRejectedValue(navErr),
    });

    await expect(scrapeCard("Chase", "http://x")).rejects.toBeInstanceOf(ScraperError);
  });
});

// ---------------------------------------------------------------------------
// ScraperError shape
// ---------------------------------------------------------------------------

describe("ScraperError", () => {
  it("preserves shape {url, issuer, reason} and message format", () => {
    const err = new ScraperError({ url: "x", issuer: "y", reason: "z" });
    expect(err.url).toBe("x");
    expect(err.issuer).toBe("y");
    expect(err.reason).toBe("z");
    expect(err.name).toBe("ScraperError");
    expect(err.message).toBe("ScraperError [y]: z — x");
  });
});

// ---------------------------------------------------------------------------
// Module structure invariants (meta-tests — protect against regression)
// ---------------------------------------------------------------------------

describe("module structure", () => {
  it("does not contain page.waitForTimeout call", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../lib/scraper/generic.ts"),
      "utf8"
    );
    expect(source).not.toContain("waitForTimeout");
  });

  it("ISSUER_SCRAPERS map is empty", () => {
    // Inspect the index.ts source — the empty map is intentional and load-bearing.
    const source = readFileSync(
      resolve(__dirname, "../../../lib/scraper/index.ts"),
      "utf8"
    );
    // Match the empty-object initializer. Non-greedy span between the name and
    // `= {}` because the type annotation contains `=>` (the function-arrow `=`
    // would otherwise be matched first); anchor on the trailing `;` so the
    // match is unambiguous.
    expect(source).toMatch(/ISSUER_SCRAPERS[\s\S]*?=\s*\{\s*\}\s*;/);
  });
});
