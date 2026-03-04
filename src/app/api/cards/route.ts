import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/cards — list all cards in master catalog with benefits
export async function GET() {
  const cards = await prisma.card.findMany({
    include: { benefits: true },
    orderBy: [{ bankName: "asc" }, { cardName: "asc" }],
  });

  return NextResponse.json(cards);
}
