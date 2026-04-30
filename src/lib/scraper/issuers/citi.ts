import { genericScrape } from "@/lib/scraper/generic";

/** Scrapes a Citi benefits page. Currently delegates to genericScrape. */
export async function scrape(url: string): Promise<string> {
  return genericScrape(url, "Citi");
}
