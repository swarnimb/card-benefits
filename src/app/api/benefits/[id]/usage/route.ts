import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateBenefitUsage } from "@/lib/engine/usage";

function fetchBenefitWithOwnership(id: string) {
  return prisma.benefit.findUnique({ where: { id }, include: { userCard: true } });
}

/** POST /api/benefits/[id]/usage — Updates the usedAmount for the current period. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let benefit;
  try {
    benefit = await fetchBenefitWithOwnership(id);
  } catch (err) {
    console.error(`POST /api/benefits/${id}/usage lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!benefit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (benefit.userCard.userId !== getUserId()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> | null;
  try {
    const raw = await request.json();
    body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  } catch {
    body = null;
  }
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { usedAmount } = body;
  if (typeof usedAmount !== "number" || !Number.isFinite(usedAmount) || usedAmount < 0) {
    return NextResponse.json({ error: "usedAmount must be a number >= 0" }, { status: 400 });
  }

  try {
    const period = await updateBenefitUsage(id, usedAmount);
    return NextResponse.json({
      id: period.id,
      usedAmount: period.usedAmount,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status,
    });
  } catch (err) {
    console.error(`POST /api/benefits/${id}/usage update error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
