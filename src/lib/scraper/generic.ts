import { chromium } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const LOAD_TIMEOUT_MS = 45_000;
const SETTLE_DELAY_MS = 3_000; // wait for JS-rendered content after DOM loads

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

/** Launches headless Chromium, navigates to the URL, and returns the page's innerText. */
export async function genericScrape(url: string, issuer = "generic"): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    try {
      // Use domcontentloaded — benefit text is in the HTML/SSR content.
      // networkidle hangs on analytics/tracking scripts that never finish.
      await page.goto(url, { timeout: LOAD_TIMEOUT_MS, waitUntil: "domcontentloaded" });

      // Give JS a few seconds to render any client-side content
      await page.waitForTimeout(SETTLE_DELAY_MS);
    } catch (err) {
      throw new ScraperError({
        url,
        issuer,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    const content = await page.evaluate(() => document.body.innerText);
    const MIN_CONTENT_LENGTH = 50;
    if (!content || content.trim().length < MIN_CONTENT_LENGTH) {
      throw new ScraperError({ url, issuer, reason: "empty_content" });
    }
    return content;
  } finally {
    await browser.close();
  }
}
