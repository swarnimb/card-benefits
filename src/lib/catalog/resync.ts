import { readFileSync } from "fs";
import { join } from "path";
import type { Card } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CatalogCard } from "@/types/card";

const CATALOG_PATH = join(process.cwd(), "data", "card-catalog.json");

/**
 * If the Card row matches a catalog entry by issuer+name, ensures
 * scrapeUrl and defaultColor reflect the catalog's current values.
 *
 * Returns the (possibly updated) Card row. For custom cards with no
 * catalog match, returns the input unchanged. Logs loudly via
 * console.error if the catalog read or DB write fails, then returns
 * the input unchanged (caller can proceed with stale data — sync
 * failure must not block the scrape itself).
 */
export async function resyncCardFromCatalog(card: Card): Promise<Card> {
  let catalog: CatalogCard[];
  try {
    catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
  } catch (err) {
    console.error("[catalog-resync] failed to read catalog:", err);
    return card;
  }

  const entry = catalog.find(
    (c) => c.issuer === card.issuer && c.name === card.name
  );
  if (!entry) return card;

  if (entry.scrapeUrl === card.scrapeUrl && entry.defaultColor === card.defaultColor) {
    return card;
  }

  try {
    return await prisma.card.update({
      where: { id: card.id },
      data: { scrapeUrl: entry.scrapeUrl, defaultColor: entry.defaultColor },
    });
  } catch (err) {
    console.error("[catalog-resync] failed to update Card row:", err);
    return card;
  }
}
