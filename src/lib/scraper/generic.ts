/**
 * Two-path content extraction pipeline for credit-card benefit URLs.
 *
 * 1. HTTP fast path — fetch() + jsdom + @mozilla/readability. Sub-second on
 *    server-rendered marketing pages (per assumption A1: Chase, Capital One,
 *    Citi). No browser launched.
 * 2. Playwright fallback — when fast path returns too little (JS-shell-only
 *    page, paywall, redirect) or fetch fails: headless Chromium with
 *    networkidle (timeout-tolerant), auto-scroll for lazy-load, click visible
 *    expanders (aria-expanded=false, <summary>, regex-matched buttons), then
 *    Readability on the post-expansion HTML. Falls back to body.innerText if
 *    Readability finds no main article.
 *
 * Failure contract preserved (CONSTRAINT-10): throws ScraperError on final
 * content < MIN_CONTENT_LENGTH; the API route maps that to
 * `200 { benefits: [], scrapeError }` so the review gate surfaces manual
 * entry.
 */
import { chromium, type Page } from "playwright";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HTTP_TIMEOUT_MS = 10_000;
const PLAYWRIGHT_NAV_TIMEOUT_MS = 30_000;
const MIN_FASTPATH_CONTENT_LENGTH = 1_500;
const MIN_CONTENT_LENGTH = 200;
/** Chars of scraped text echoed in the DEBUG probe line (Task 47 / NEW-6 triage). */
const SCRAPE_PREVIEW_LENGTH = 500;
const SCROLL_STEP_PX = 800;
const SCROLL_PAUSE_MS = 250;
const MAX_SCROLL_ITERS = 10;
const MAX_EXPANSION_CLICKS = 30;
const EXPANSION_REGEX = /show more|see details|view (all )?benefits?|read more|expand/i;

export class ScraperError extends Error {
  url: string;
  issuer: string;
  reason: string;

  constructor({ url, issuer, reason }: { url: string; issuer: string; reason: string }) {
    super(`ScraperError [${issuer}]: ${reason} — ${url}`);
    this.name = "ScraperError";
    this.url = url;
    this.issuer = issuer;
    this.reason = reason;
  }
}

/**
 * Scrape benefit content from any credit-card marketing URL.
 * Tries fast HTTP fetch first; falls back to Playwright if needed.
 */
export async function genericScrape(url: string, issuer = "generic"): Promise<string> {
  const fastPathResult = await tryHttpFastPath(url);
  const path = fastPathResult ? "http-fast-path" : "playwright-fallback";
  const rawText = fastPathResult || (await tryPlaywrightFallback(url, issuer));
  const preview = rawText.slice(0, SCRAPE_PREVIEW_LENGTH).replace(/\s+/g, " ");
  debugLog(`path=${path} rawText.length=${rawText.length} preview="${preview}"`);
  return rawText;
}

async function tryHttpFastPath(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const extracted = extractWithReadability(html, url);
    if (extracted && extracted.length >= MIN_FASTPATH_CONTENT_LENGTH) return extracted;
    return null;
  } catch {
    // Any fetch/parse failure → fall through to Playwright.
    return null;
  }
}

async function tryPlaywrightFallback(url: string, issuer: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await page
        .goto(url, { waitUntil: "networkidle", timeout: PLAYWRIGHT_NAV_TIMEOUT_MS })
        .catch((err: Error) => {
          // networkidle commonly times out on pages with persistent analytics —
          // tolerate that specific case, rethrow everything else.
          if (err.name !== "TimeoutError") throw err;
        });
    } catch (err) {
      throw new ScraperError({
        url,
        issuer,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    // Best-effort: scroll/expand can throw on eval-locked issuer pages (Amex) — must not abort the scrape.
    try {
      await autoScroll(page);
      await expandCollapsedSections(page);
    } catch (err) {
      debugLog(`scroll/expand skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    const html = await page.content();
    const extracted = extractWithReadability(html, url);
    if (extracted && extracted.length >= MIN_CONTENT_LENGTH) return extracted;

    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText && bodyText.trim().length >= MIN_CONTENT_LENGTH) return bodyText;

    throw new ScraperError({ url, issuer, reason: "empty_content" });
  } finally {
    await browser.close();
  }
}

/** Run Mozilla Readability against an HTML blob; returns trimmed main-article text or null. */
function extractWithReadability(html: string, url: string): string | null {
  try {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Scroll the page in fixed steps to trigger lazy-loaded content, then restore scroll position. */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(
    async ({ stepPx, pauseMs, maxIters }) => {
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      for (let i = 0; i < maxIters; i++) {
        window.scrollBy(0, stepPx);
        await sleep(pauseMs);
        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) break;
      }
      window.scrollTo(0, 0);
    },
    { stepPx: SCROLL_STEP_PX, pauseMs: SCROLL_PAUSE_MS, maxIters: MAX_SCROLL_ITERS }
  );
}

/**
 * Click visible expanders so collapsed benefit text becomes part of the DOM.
 *
 * Note on selectors: Playwright's `:visible` pseudo is supported on the
 * installed version, but we keep the per-element `.click({ timeout })` swallow
 * so a non-visible / detached match cannot throw and abort the loop.
 */
async function expandCollapsedSections(page: Page): Promise<void> {
  let clicks = 0;

  const ariaCollapsed = page.locator('[aria-expanded="false"]');
  for (const handle of await ariaCollapsed.all()) {
    if (clicks >= MAX_EXPANSION_CLICKS) return;
    await handle.click({ timeout: 2_000 }).catch(() => {});
    clicks++;
  }

  const closedDetails = page.locator("details:not([open]) > summary");
  for (const handle of await closedDetails.all()) {
    if (clicks >= MAX_EXPANSION_CLICKS) return;
    await handle.click({ timeout: 2_000 }).catch(() => {});
    clicks++;
  }

  const buttonish = page.locator('button:visible, a[role="button"]:visible');
  for (const handle of await buttonish.all()) {
    if (clicks >= MAX_EXPANSION_CLICKS) return;
    const text = await handle.textContent().catch(() => null);
    if (text && EXPANSION_REGEX.test(text)) {
      await handle.click({ timeout: 2_000 }).catch(() => {});
      clicks++;
    }
  }
}

/**
 * Gated debug log — EH-01 (not silent) / EH-02 (context). Visible only when
 * DEBUG=true. Third copy of the Task 45 pattern (also in parser/index.ts and
 * parser/classification.ts). The shared-util extraction the Task 45 comment
 * anticipated is deliberately deferred — pulling parser files into this probe
 * task's scope would widen its blast radius. Tracked as a follow-up cleanup.
 */
function debugLog(message: string): void {
  if (process.env.DEBUG === "true") {
    console.log("[scraper] " + message);
  }
}
