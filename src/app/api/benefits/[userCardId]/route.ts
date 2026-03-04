import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateAllUtilizations } from "@/lib/engine/utilization";
import { estimatePoints } from "@/lib/engine/points";
import type { CardBenefitsResponse } from "@/types/card";

type RouteParams = { params: Promise<{ userCardId: string }> };

// GET /api/benefits/[userCardId] — returns benefits with utilization + points estimate
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userCardId } = await params;

  // Load user card with card + benefits
  const userCard = await prisma.userCard.findUnique({
    where: { id: userCardId },
    include: {
      card: {
        include: { benefits: true },
      },
    },
  });

  if (!userCard) {
    return NextResponse.json(
      { error: `UserCard ${userCardId} not found` },
      { status: 404 }
    );
  }

  // Load all transactions for this card
  const transactions = await prisma.transaction.findMany({
    where: { userCardId },
    orderBy: { date: "desc" },
  });

  // Calculate utilization for each benefit
  const benefitsWithUtilization = calculateAllUtilizations(
    userCard.card.benefits,
    transactions
  );

  // Calculate points estimate
  const points = estimatePoints(
    userCard.pointBalance,
    userCard.pointBalanceUpdatedAt,
    userCard.card.benefits,
    transactions
  );

  const response: CardBenefitsResponse = {
    userCard: {
      id: userCard.id,
      cardId: userCard.cardId,
      pointBalance: userCard.pointBalance,
      pointBalanceUpdatedAt: userCard.pointBalanceUpdatedAt,
      createdAt: userCard.createdAt,
    },
    card: {
      id: userCard.card.id,
      bankName: userCard.card.bankName,
      cardName: userCard.card.cardName,
      cardType: userCard.card.cardType,
      annualFee: userCard.card.annualFee,
      imageColor: userCard.card.imageColor,
      createdAt: userCard.card.createdAt,
      updatedAt: userCard.card.updatedAt,
    },
    benefits: benefitsWithUtilization,
    points,
  };

  return NextResponse.json(response);
}
