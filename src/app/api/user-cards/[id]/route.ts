import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

type UserCardUpdateData = {
  displayOrder?: number;
  statementDay?: number | null;
  anniversaryDate?: Date | null;
};

function buildUserCardUpdate(body: Record<string, unknown>): UserCardUpdateData | string {
  const data: UserCardUpdateData = {};
  if ("displayOrder" in body && typeof body.displayOrder === "number") {
    if (!Number.isInteger(body.displayOrder) || body.displayOrder < 0) {
      return "displayOrder must be a non-negative integer";
    }
    data.displayOrder = body.displayOrder;
  }
  if ("statementDay" in body) {
    if (body.statementDay !== null) {
      if (typeof body.statementDay !== "number" || !Number.isInteger(body.statementDay) || body.statementDay < 1 || body.statementDay > 31) {
        return "statementDay must be an integer 1-31 or null";
      }
      data.statementDay = body.statementDay;
    } else {
      data.statementDay = null;
    }
  }
  if ("anniversaryDate" in body) {
    if (body.anniversaryDate !== null) {
      const parsed = new Date(body.anniversaryDate as string);
      if (isNaN(parsed.getTime())) return "anniversaryDate must be a valid date or null";
      data.anniversaryDate = parsed;
    } else {
      data.anniversaryDate = null;
    }
  }
  return data;
}

async function parseJsonBody(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  } catch {
    // Invalid JSON body — caller returns 400
    return null;
  }
}

/** PATCH /api/user-cards/[id] — Updates displayOrder, statementDay, or anniversaryDate. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = getUserId();

  let userCard;
  try {
    userCard = await prisma.userCard.findUnique({ where: { id } });
  } catch (err) {
    console.error(`PATCH /api/user-cards/${id} lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!userCard) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userCard.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const updateOrError = buildUserCardUpdate(body);
  if (typeof updateOrError === "string") {
    return NextResponse.json({ error: updateOrError }, { status: 400 });
  }

  try {
    const updated = await prisma.userCard.update({
      where: { id },
      data: updateOrError,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`PATCH /api/user-cards/${id} update error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/user-cards/[id] — Removes a user card and cascades to its benefits. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = getUserId();

  let userCard;
  try {
    userCard = await prisma.userCard.findUnique({ where: { id } });
  } catch (err) {
    console.error(`DELETE /api/user-cards/${id} lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!userCard) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userCard.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.userCard.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/user-cards/${id} delete error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
