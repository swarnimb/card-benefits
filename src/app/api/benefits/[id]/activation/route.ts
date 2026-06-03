import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setBenefitActivation } from "@/lib/engine/usage";

function fetchBenefitWithOwnership(id: string) {
  return prisma.benefit.findUnique({ where: { id }, include: { userCard: true } });
}

/** PATCH /api/benefits/[id]/activation — Toggles a set-and-forget benefit's activation. */
export async function PATCH(
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
    console.error(`PATCH /api/benefits/${id}/activation lookup error:`, err);
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

  const { activated } = body;
  if (typeof activated !== "boolean") {
    return NextResponse.json({ error: "activated must be true or false" }, { status: 400 });
  }

  if (!benefit.setAndForget) {
    return NextResponse.json(
      { error: "benefit is not set-and-forget; activation does not apply" },
      { status: 409 }
    );
  }

  try {
    const updated = await setBenefitActivation(id, activated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`PATCH /api/benefits/${id}/activation update error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
