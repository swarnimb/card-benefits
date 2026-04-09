import { chromium, errors } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PAGE_LOAD_TIMEOUT_MS = 30_000; // max wait for networkidle before throwing ScraperError

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

export async function genericScrape(url: string, issuer = "generic"): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    try {
      await page.goto(url, { timeout: PAGE_LOAD_TIMEOUT_MS, waitUntil: "networkidle" });
    } catch (err) {
      if (err instanceof errors.TimeoutError) {
        throw new ScraperError({ url, issuer, reason: "timeout" });
      }
      throw new ScraperError({
        url,
        issuer,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    return page.evaluate(() => document.body.innerText);
  } finally {
    await browser.close();
  }
}
