import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import { toBenefitWithPeriod } from "@/lib/engine/mappers";
import type { BenefitWithPeriod } from "@/types/benefit";

const TYPE_ORDER = ["credit", "subscription", "access", "perk"];

/** GET /api/user-cards/[id]/benefits — Returns all benefits with current period data for a card. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userCardId } = await params;
  const userId = getUserId();

  let userCard;
  try {
    userCard = await prisma.userCard.findUnique({ where: { id: userCardId } });
  } catch (err) {
    console.error(`GET /api/user-cards/${userCardId}/benefits lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!userCard) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userCard.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const benefits = await prisma.benefit.findMany({ where: { userCardId }, orderBy: { createdAt: "asc" } });
    const result: BenefitWithPeriod[] = [];
    for (const benefit of benefits) {
      const period = benefit.isTrackable ? await ensureCurrentPeriod(benefit.id) : null;
      result.push(toBenefitWithPeriod(benefit, period));
    }
    result.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    return NextResponse.json(result);
  } catch (err) {
    console.error(`GET /api/user-cards/${userCardId}/benefits data error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
