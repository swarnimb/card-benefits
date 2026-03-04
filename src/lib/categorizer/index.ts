import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import type { BenefitCategory } from "@/types/card";
import type { CategoryMap } from "@/types/transaction";

const VALID_CATEGORIES: BenefitCategory[] = [
  "dining",
  "travel",
  "groceries",
  "gas",
  "streaming",
  "entertainment",
  "drugstore",
  "transit",
  "general",
];

const MAX_BATCH_SIZE = 50;

/**
 * Categorizes a list of merchant names using cached results + Claude Haiku.
 * Returns a map of merchant → BenefitCategory.
 */
export async function categorizeMerchants(
  merchants: string[]
): Promise<CategoryMap> {
  const uniqueMerchants = [...new Set(merchants.map((m) => m.toLowerCase()))];
  const result: CategoryMap = {};

  // Step 1: Check cache (existing transactions with assigned categories)
  const cached = await getCachedCategories(uniqueMerchants);
  const uncached: string[] = [];

  for (const merchant of uniqueMerchants) {
    if (cached[merchant]) {
      result[merchant] = cached[merchant];
    } else {
      uncached.push(merchant);
    }
  }

  if (uncached.length === 0) return result;

  // Step 2: Call Claude Haiku for uncached merchants (in batches)
  for (let i = 0; i < uncached.length; i += MAX_BATCH_SIZE) {
    const batch = uncached.slice(i, i + MAX_BATCH_SIZE);
    const llmResults = await callClaude(batch);

    for (const [merchant, category] of Object.entries(llmResults)) {
      result[merchant.toLowerCase()] = category;
    }
  }

  return result;
}

/**
 * Looks up previously categorized merchants from the database.
 * Uses the most recent assignedCategory for each merchant.
 */
async function getCachedCategories(
  merchants: string[]
): Promise<CategoryMap> {
  const cached: CategoryMap = {};

  const existing = await prisma.transaction.findMany({
    where: {
      merchant: { in: merchants },
      assignedCategory: { not: "uncategorized" },
    },
    select: { merchant: true, assignedCategory: true },
    distinct: ["merchant"],
  });

  for (const tx of existing) {
    const category = tx.assignedCategory as BenefitCategory;
    if (VALID_CATEGORIES.includes(category)) {
      cached[tx.merchant.toLowerCase()] = category;
    }
  }

  return cached;
}

/**
 * Calls Claude Haiku to categorize a batch of merchant names.
 */
async function callClaude(merchants: string[]): Promise<CategoryMap> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set — cannot categorize transactions"
    );
  }

  const client = new Anthropic({ apiKey });

  const categoriesStr = VALID_CATEGORIES.join(", ");
  const merchantList = merchants
    .map((m, i) => `${i + 1}. ${m}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Categorize each merchant into exactly one category.

Categories: ${categoriesStr}

Rules:
- Restaurants, fast food, coffee shops, food delivery → dining
- Airlines, hotels, car rentals, booking sites → travel
- Grocery stores, supermarkets → groceries
- Gas stations, EV charging → gas
- Netflix, Spotify, Hulu, Disney+ → streaming
- Movies, concerts, games, sports → entertainment
- Pharmacies, CVS, Walgreens → drugstore
- Uber, Lyft, subway, bus, tolls → transit
- Everything else → general

Merchants:
${merchantList}

Respond ONLY with a JSON object mapping each merchant name (exactly as given) to its category. No explanation.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback: assign all as "general"
    const fallback: CategoryMap = {};
    for (const m of merchants) {
      fallback[m] = "general";
    }
    return fallback;
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
  const result: CategoryMap = {};

  for (const [merchant, category] of Object.entries(parsed)) {
    result[merchant] = VALID_CATEGORIES.includes(category as BenefitCategory)
      ? (category as BenefitCategory)
      : "general";
  }

  // Fill in any merchants the LLM missed
  for (const m of merchants) {
    if (!result[m]) {
      result[m] = "general";
    }
  }

  return result;
}
