import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import { buildOverviewTriage } from "@/lib/engine/expiring";
import { toBenefitWithPeriod } from "@/lib/engine/mappers";
import type { BenefitWithPeriod } from "@/types/benefit";
import type { UserCardWithBenefits, Issuer } from "@/types/card";
import type { OverviewData } from "@/types/api";

/** GET /api/overview — Returns aggregated credit categories and expiring-soon alerts. */
export async function GET(_req: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getUserId();

  try {
    const userCards = await prisma.userCard.findMany({
      where: { userId },
      include: { card: true, benefits: true },
      orderBy: { displayOrder: "asc" },
    });

    const cards: UserCardWithBenefits[] = [];
    for (const userCard of userCards) {
      const benefitsWithPeriods: BenefitWithPeriod[] = [];
      for (const benefit of userCard.benefits) {
        const period = benefit.tracked && !benefit.setAndForget ? await ensureCurrentPeriod(benefit.id) : null;
        benefitsWithPeriods.push(toBenefitWithPeriod(benefit, period));
      }
      cards.push({
        id: userCard.id,
        userId: userCard.userId,
        cardId: userCard.cardId,
        displayOrder: userCard.displayOrder,
        lastVerifiedAt: userCard.lastVerifiedAt,
        statementDay: userCard.statementDay,
        anniversaryDate: userCard.anniversaryDate,
        createdAt: userCard.createdAt,
        card: {
          id: userCard.card.id,
          issuer: userCard.card.issuer as Issuer,
          name: userCard.card.name,
          scrapeUrl: userCard.card.scrapeUrl,
          defaultColor: userCard.card.defaultColor,
        },
        benefits: benefitsWithPeriods,
      });
    }

    const overview: OverviewData = buildOverviewTriage(cards);

    return NextResponse.json(overview);
  } catch (err) {
    console.error("GET /api/overview error:", {
      userId,
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : err,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
