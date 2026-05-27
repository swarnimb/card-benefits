import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculatePeriodBoundary } from "@/lib/engine/periods";
import { deriveTracked, isValidClassification, normalizeClassification } from "@/lib/parser/classification";
import type { DraftBenefit } from "@/types/benefit";

const VALID_TYPES = new Set(["credit", "subscription", "access", "perk"]);
const VALID_VALUE_UNITS = new Set(["dollars", "points"]);
const VALID_RESET_PERIODS = new Set(["monthly", "quarterly", "annual", "once"]);
const VALID_RESET_ANCHORS = new Set(["calendar", "statement", "anniversary"]);
const VALID_CATEGORIES = new Set(["dining", "travel", "streaming", "shopping", "lounge", "general"]);

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

function validateBenefits(items: unknown[]): string | null {
  for (const item of items) {
    if (!item || typeof item !== "object") return "each benefit must be an object";
    const b = item as Record<string, unknown>;
    if (typeof b.name !== "string" || b.name.length === 0) return "name is required and must be a string";
    if (b.name.length > MAX_NAME_LENGTH) return `name must be ${MAX_NAME_LENGTH} characters or less`;
    if (b.description !== undefined && b.description !== null && typeof b.description !== "string") return "description must be a string or null";
    if (typeof b.description === "string" && b.description.length > MAX_DESCRIPTION_LENGTH) return `description must be ${MAX_DESCRIPTION_LENGTH} characters or less`;
    if (!VALID_TYPES.has(b.type as string)) return `invalid type: "${b.type}"`;
    if (b.value !== undefined && b.value !== null && (typeof b.value !== "number" || !Number.isFinite(b.value) || b.value < 0)) return "value must be a non-negative number or null";
    if (b.valueUnit !== undefined && !VALID_VALUE_UNITS.has(b.valueUnit as string)) return `invalid valueUnit: "${b.valueUnit}"`;
    if (!VALID_RESET_PERIODS.has(b.resetPeriod as string)) return `invalid resetPeriod: "${b.resetPeriod}"`;
    if (!VALID_RESET_ANCHORS.has(b.resetAnchor as string)) return `invalid resetAnchor: "${b.resetAnchor}"`;
    if (!VALID_CATEGORIES.has(b.category as string)) return `invalid category: "${b.category}"`;
    // `tracked` is optional: server falls back to deriveTracked(classification) when client omits it.
    // When the client DOES supply tracked, it must be a boolean and the client value wins (user override).
    if (b.tracked !== undefined && typeof b.tracked !== "boolean") return "tracked must be true or false";
    if (!isValidClassification(b.classification)) return `Invalid value for field classification: "${b.classification}"`;
  }
  return null;
}

async function runConfirmTransaction(
  userCardId: string,
  benefits: DraftBenefit[],
  userCard: { statementDay: number | null; anniversaryDate: Date | null }
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.benefit.deleteMany({ where: { userCardId } });
    for (const b of benefits) {
      // tracked: server uses `deriveTracked(classification)` as the DEFAULT
      // (when the client omits the field). A client-supplied boolean WINS —
      // it represents the user's explicit override at the review gate
      // (Decision A updated 2026-05-26). `classification` itself remains
      // server-only / non-editable. Excluded benefits are still persisted
      // (tracked=false) — never dropped.
      const tracked = typeof b.tracked === "boolean" ? b.tracked : deriveTracked(b.classification);
      const created = await tx.benefit.create({
        data: {
          userCardId,
          name: b.name,
          description: b.description ?? null,
          type: b.type,
          value: b.value ?? null,
          valueUnit: b.valueUnit ?? "dollars",
          resetPeriod: b.resetPeriod,
          resetAnchor: b.resetAnchor,
          category: b.category,
          classification: normalizeClassification(b.classification),
          tracked,
        },
      });
      if (tracked) {
        // Fall back to calendar if anchor requires data the card doesn't have
        let effectiveAnchor = b.resetAnchor;
        if (effectiveAnchor === "anniversary" && !userCard.anniversaryDate) effectiveAnchor = "calendar";
        if (effectiveAnchor === "statement" && !userCard.statementDay) effectiveAnchor = "calendar";

        const { periodStart, periodEnd } = calculatePeriodBoundary(
          b.resetPeriod, effectiveAnchor, now,
          userCard.statementDay ?? undefined,
          userCard.anniversaryDate ?? undefined,
        );
        await tx.benefitPeriod.create({
          data: { benefitId: created.id, periodStart, periodEnd, usedAmount: 0, status: "open" },
        });
      }
    }
    await tx.userCard.update({ where: { id: userCardId }, data: { lastVerifiedAt: now } });
  });
}

/** POST /api/benefits/confirm — Bulk-saves confirmed benefits (replaces all for the card). */
export async function POST(request: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userCardId, benefits } = body;
  if (!userCardId || typeof userCardId !== "string") {
    return NextResponse.json({ error: "userCardId is required" }, { status: 400 });
  }
  if (!Array.isArray(benefits) || benefits.length === 0) {
    return NextResponse.json({ error: "benefits must not be empty" }, { status: 400 });
  }
  const validationError = validateBenefits(benefits);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  let userCard;
  try {
    userCard = await prisma.userCard.findUnique({ where: { id: userCardId } });
  } catch (err) {
    console.error(`POST /api/benefits/confirm DB lookup error userCardId=${userCardId}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!userCard) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userCard.userId !== getUserId()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await runConfirmTransaction(userCardId, benefits as DraftBenefit[], userCard);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/benefits/confirm transaction error userCardId=${userCardId}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
