import { genericScrape } from "@/lib/scraper/generic";

export async function scrape(url: string): Promise<string> {
  return genericScrape(url, "Chase");
}
