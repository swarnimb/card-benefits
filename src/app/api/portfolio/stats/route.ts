import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computePortfolioStats } from "@/lib/engine/portfolio";
import type { PortfolioCardInput } from "@/lib/engine/portfolio";

/** GET /api/portfolio/stats — Portfolio-wide annual fee / redeemed YTD / available figures (read-only). */
export async function GET(_request: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = getUserId();
    const userCards = await prisma.userCard.findMany({
      where: { userId },
      include: { card: true, benefits: { include: { periods: true } } },
    });

    const cards: PortfolioCardInput[] = userCards.map((uc) => ({
      annualFee: uc.card.annualFee,
      benefits: uc.benefits.map((b) => ({
        tracked: b.tracked,
        resetPeriod: b.resetPeriod,
        setAndForget: b.setAndForget,
        value: b.value,
        periods: b.periods,
      })),
    }));

    const stats = computePortfolioStats(cards);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GET /api/portfolio/stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
