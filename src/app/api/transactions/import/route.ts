import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/csv/parser";
import type { ImportPreview, ParsedTransaction } from "@/types/transaction";

// POST /api/transactions/import — parse CSV, detect bank, find duplicates, return preview
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const userCardId = formData.get("userCardId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!userCardId) {
    return NextResponse.json(
      { error: "No userCardId provided" },
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

  // Read and parse CSV
  const csvString = await file.text();
  const parseResult = parseCsv(csvString);

  if (parseResult.transactions.length === 0) {
    return NextResponse.json(
      {
        error: "No valid transactions found in CSV",
        details: parseResult.errors,
      },
      { status: 400 }
    );
  }

  // Detect duplicates against existing transactions for this card
  const { unique, duplicateCount } = await deduplicateTransactions(
    parseResult.transactions,
    userCardId
  );

  // Calculate date range
  const dates = unique.map((t) => t.date).sort();
  const dateRange = {
    start: dates[0],
    end: dates[dates.length - 1],
  };

  const preview: ImportPreview = {
    transactions: unique,
    totalCount: unique.length,
    duplicateCount,
    dateRange,
    detectedBank: parseResult.detectedBank,
  };

  return NextResponse.json(preview);
}

/**
 * Checks parsed transactions against existing DB transactions
 * for the same card. A duplicate = same date + merchant + amount.
 */
async function deduplicateTransactions(
  parsed: ParsedTransaction[],
  userCardId: string
): Promise<{ unique: ParsedTransaction[]; duplicateCount: number }> {
  // Get all existing transactions for this card
  const existing = await prisma.transaction.findMany({
    where: { userCardId },
    select: { date: true, merchant: true, amount: true },
  });

  // Build a set of "date|merchant|amount" keys for fast lookup
  const existingKeys = new Set(
    existing.map(
      (t) =>
        `${t.date.toISOString().split("T")[0]}|${t.merchant.toLowerCase()}|${t.amount}`
    )
  );

  const unique: ParsedTransaction[] = [];
  let duplicateCount = 0;

  for (const t of parsed) {
    const key = `${t.date}|${t.merchant.toLowerCase()}|${t.amount}`;
    if (existingKeys.has(key)) {
      duplicateCount++;
    } else {
      unique.push(t);
    }
  }

  return { unique, duplicateCount };
}
