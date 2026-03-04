import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/cards/user/[id] — update point balance
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const userCard = await prisma.userCard.findUnique({ where: { id } });
  if (!userCard) {
    return NextResponse.json(
      { error: `UserCard ${id} not found` },
      { status: 404 }
    );
  }

  const body = await request.json();

  if (body.pointBalance !== undefined && typeof body.pointBalance !== "number") {
    return NextResponse.json(
      { error: "pointBalance must be a number" },
      { status: 400 }
    );
  }

  const updated = await prisma.userCard.update({
    where: { id },
    data: {
      pointBalance: body.pointBalance ?? null,
      pointBalanceUpdatedAt:
        body.pointBalance !== undefined ? new Date() : undefined,
    },
    include: { card: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/cards/user/[id] — remove card + cascade transactions
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const userCard = await prisma.userCard.findUnique({ where: { id } });
  if (!userCard) {
    return NextResponse.json(
      { error: `UserCard ${id} not found` },
      { status: 404 }
    );
  }

  // Cascade: delete import batches and transactions first (SQLite FK enforcement)
  await prisma.transaction.deleteMany({ where: { userCardId: id } });
  await prisma.importBatch.deleteMany({ where: { userCardId: id } });
  await prisma.userCard.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id });
}
