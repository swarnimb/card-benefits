import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { TransactionsResponse } from "@/types/transaction";

type RouteParams = { params: Promise<{ userCardId: string }> };

// GET /api/transactions/[userCardId] — list transactions for a card
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userCardId } = await params;

  const userCard = await prisma.userCard.findUnique({
    where: { id: userCardId },
  });
  if (!userCard) {
    return NextResponse.json(
      { error: `UserCard ${userCardId} not found` },
      { status: 404 }
    );
  }

  const transactions = await prisma.transaction.findMany({
    where: { userCardId },
    orderBy: { date: "desc" },
  });

  const response: TransactionsResponse = {
    transactions,
    totalCount: transactions.length,
  };

  return NextResponse.json(response);
}

// DELETE /api/transactions/[userCardId] — clear all transactions for a card
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { userCardId } = await params;

  const userCard = await prisma.userCard.findUnique({
    where: { id: userCardId },
  });
  if (!userCard) {
    return NextResponse.json(
      { error: `UserCard ${userCardId} not found` },
      { status: 404 }
    );
  }

  // Delete transactions and import batches (cascade handles transactions → batches)
  const deleted = await prisma.$transaction(async (tx) => {
    const count = await tx.transaction.deleteMany({
      where: { userCardId },
    });
    await tx.importBatch.deleteMany({
      where: { userCardId },
    });
    return count.count;
  });

  return NextResponse.json({ deleted });
}
