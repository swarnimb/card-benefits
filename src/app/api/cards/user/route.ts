import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/cards/user — list user's selected cards with card + benefit data
export async function GET() {
  const userCards = await prisma.userCard.findMany({
    include: {
      card: {
        include: { benefits: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(userCards);
}

// POST /api/cards/user — add card(s) to user's collection
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Accept single cardId or array of cardIds
  const cardIds: string[] = Array.isArray(body.cardIds)
    ? body.cardIds
    : body.cardId
      ? [body.cardId]
      : [];

  if (cardIds.length === 0) {
    return NextResponse.json(
      { error: "cardId or cardIds[] is required" },
      { status: 400 }
    );
  }

  // Verify all cards exist
  const existingCards = await prisma.card.findMany({
    where: { id: { in: cardIds } },
    select: { id: true },
  });

  const existingIds = new Set(existingCards.map((c) => c.id));
  const invalidIds = cardIds.filter((id) => !existingIds.has(id));

  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Card(s) not found: ${invalidIds.join(", ")}` },
      { status: 404 }
    );
  }

  // Create user cards (skip duplicates)
  const created = [];
  for (const cardId of cardIds) {
    const existing = await prisma.userCard.findUnique({
      where: { cardId },
    });

    if (!existing) {
      const userCard = await prisma.userCard.create({
        data: { cardId },
        include: { card: { include: { benefits: true } } },
      });
      created.push(userCard);
    }
  }

  return NextResponse.json(
    { added: created.length, userCards: created },
    { status: 201 }
  );
}
