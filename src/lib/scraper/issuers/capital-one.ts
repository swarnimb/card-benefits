import { genericScrape } from "@/lib/scraper/generic";

/** Scrapes a Capital One benefits page. Currently delegates to genericScrape. */
export async function scrape(url: string): Promise<string> {
  return genericScrape(url, "Capital One");
}
