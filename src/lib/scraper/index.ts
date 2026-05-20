import { genericScrape } from "@/lib/scraper/generic";

/**
 * Issuer-specific scraper overrides.
 *
 * Empty by default — the generic pipeline (HTTP fast path + Playwright with
 * Readability extraction) handles every issuer in the catalog. Populate this
 * map only when a specific bank requires special handling (e.g., Amex
 * anti-bot stealth, Chase login walls). Keeping the map keeps the extension
 * point alive without claiming the per-issuer logic exists.
 */
const ISSUER_SCRAPERS: Record<string, (url: string, issuer: string) => Promise<string>> = {};

/** Dispatches to an issuer-specific scraper or falls back to genericScrape. */
export async function scrapeCard(issuer: string, url: string): Promise<string> {
  const scraper = ISSUER_SCRAPERS[issuer] ?? genericScrape;
  return scraper(url, issuer);
}
