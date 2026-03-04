import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categorizeMerchants } from "@/lib/categorizer";
import type { BenefitCategory } from "@/types/card";
import type {
  ImportConfirmRequest,
  ImportConfirmResponse,
  ParsedTransaction,
} from "@/types/transaction";

// Bank CSV categories → our BenefitCategory (fallback when no API key)
const BANK_CATEGORY_MAP: Record<string, BenefitCategory> = {
  "food & drink": "dining",
  "dining": "dining",
  "restaurants": "dining",
  "restaurant": "dining",
  "travel": "travel",
  "airlines": "travel",
  "hotels": "travel",
  "car rental": "travel",
  "groceries": "groceries",
  "grocery": "groceries",
  "supermarkets": "groceries",
  "gas": "gas",
  "gas stations": "gas",
  "fuel": "gas",
  "entertainment": "entertainment",
  "streaming": "streaming",
  "streaming services": "streaming",
  "drugstore": "drugstore",
  "pharmacy": "drugstore",
  "health": "drugstore",
  "transit": "transit",
  "ride share": "transit",
  "transportation": "transit",
};

// POST /api/transactions/confirm — categorize + store transactions + create ImportBatch
export async function POST(request: NextRequest) {
  const body = (await request.json()) as ImportConfirmRequest;
  const { userCardId, transactions, fileName } = body;

  if (!userCardId || !transactions || !fileName) {
    return NextResponse.json(
      { error: "Missing required fields: userCardId, transactions, fileName" },
      { status: 400 }
    );
  }

  if (transactions.length === 0) {
    return NextResponse.json(
      { error: "No transactions to import" },
      { status: 400 }
    );
  }

  // Verify userCard exists
  const userCard = await prisma.userCard.findUnique({
    where: { id: userCardId },
  });
  if (!userCard) {
    return NextResponse.json(
      { error: `UserCard ${userCardId} not found` },
      { status: 404 }
    );
  }

  // Categorize merchants (LLM if API key set, fallback to bank category map)
  const categoryAssignments = await categorizeTransactions(transactions);

  // Calculate date range for the batch
  const dates = transactions
    .map((t) => new Date(t.date))
    .sort((a, b) => a.getTime() - b.getTime());

  // Create ImportBatch + Transactions in a single DB transaction
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        userCardId,
        fileName,
        transactionCount: transactions.length,
        dateRangeStart: dates[0],
        dateRangeEnd: dates[dates.length - 1],
      },
    });

    await tx.transaction.createMany({
      data: transactions.map((t) => ({
        userCardId,
        importBatchId: batch.id,
        date: new Date(t.date),
        merchant: t.merchant,
        description: t.description,
        amount: t.amount,
        bankCategory: t.bankCategory,
        assignedCategory:
          categoryAssignments.get(t.merchant.toLowerCase()) ?? "general",
      })),
    });

    return batch;
  });

  const categorizedCount = [...categoryAssignments.values()].filter(
    (c) => c !== "general"
  ).length;

  const response: ImportConfirmResponse = {
    importBatchId: result.id,
    transactionCount: transactions.length,
    categorized: categorizedCount,
  };

  return NextResponse.json(response, { status: 201 });
}

/**
 * Categorizes transactions. Tries LLM first (if API key set),
 * falls back to mapping bank-provided categories.
 */
async function categorizeTransactions(
  transactions: ParsedTransaction[]
): Promise<Map<string, BenefitCategory>> {
  const merchants = [...new Set(transactions.map((t) => t.merchant))];
  const result = new Map<string, BenefitCategory>();

  // Try LLM categorization if API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    const llmCategories = await categorizeMerchants(merchants);
    for (const [merchant, category] of Object.entries(llmCategories)) {
      result.set(merchant.toLowerCase(), category);
    }
    return result;
  }

  // Fallback: map bank categories to our categories
  for (const tx of transactions) {
    const key = tx.merchant.toLowerCase();
    if (result.has(key)) continue;

    if (tx.bankCategory) {
      const category = mapBankCategory(tx.bankCategory);
      result.set(key, category);
    } else {
      result.set(key, "general");
    }
  }

  return result;
}

/**
 * Maps a bank-provided category string to our BenefitCategory.
 * Handles compound formats like "Merchandise & Supplies-Groceries" (Amex)
 * by splitting on "-" and trying each segment.
 */
function mapBankCategory(bankCategory: string): BenefitCategory {
  const lower = bankCategory.toLowerCase();

  // Direct match first
  const direct = BANK_CATEGORY_MAP[lower];
  if (direct) return direct;

  // Try splitting on "-" for compound categories (e.g. Amex format)
  const segments = lower.split("-").map((s) => s.trim());
  for (const segment of segments) {
    const mapped = BANK_CATEGORY_MAP[segment];
    if (mapped) return mapped;
  }

  return "general";
}
