import { genericScrape } from "@/lib/scraper/generic";
import { scrape as amexScrape } from "@/lib/scraper/issuers/amex";
import { scrape as chaseScrape } from "@/lib/scraper/issuers/chase";
import { scrape as capitalOneScrape } from "@/lib/scraper/issuers/capital-one";
import { scrape as citiScrape } from "@/lib/scraper/issuers/citi";
import { scrape as discoverScrape } from "@/lib/scraper/issuers/discover";

const ISSUER_SCRAPERS: Record<string, (url: string) => Promise<string>> = {
  Amex: amexScrape,
  Chase: chaseScrape,
  "Capital One": capitalOneScrape,
  Citi: citiScrape,
  Discover: discoverScrape,
};

export async function scrapeCard(issuer: string, url: string): Promise<string> {
  const scraper = ISSUER_SCRAPERS[issuer] ?? genericScrape;
  return scraper(url);
}
