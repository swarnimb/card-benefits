import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createBenefitWithPeriod } from "@/lib/engine/benefit-create";
import { isValidClassification } from "@/lib/parser/classification";
import type { DraftBenefit } from "@/types/benefit";
import {
  VALID_TYPES,
  VALID_VALUE_UNITS,
  VALID_RESET_PERIODS,
  VALID_RESET_ANCHORS,
} from "@/lib/validation/benefit-enums";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * Boundary validation for the optional card-level annual fee (CONSTRAINT-21).
 * Returns a LOUD, context-bearing error string for anything that is not
 * (finite number >= 0) | null | undefined; returns null when valid. Mirrors the
 * existing `value` rule (non-negative finite number or null) — never coerces a
 * bad value silently (EH-01 / SEC-02).
 */
function validateAnnualFee(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return `annualFee must be a non-negative number or null (got ${JSON.stringify(value)})`;
  }
  return null;
}

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
    // category is NOT rejected — it is coerced to "general" at write time via
    // coerceCategory (an out-of-enum LLM slip should not block the whole save).
    // `tracked` is optional: server falls back to deriveTracked(classification) when client omits it.
    // When the client DOES supply tracked, it must be a boolean and the client value wins (user override).
    if (b.tracked !== undefined && typeof b.tracked !== "boolean") return "tracked must be true or false";
    if (!isValidClassification(b.classification)) return `Invalid value for field classification: "${b.classification}"`;
  }
  return null;
}

async function runConfirmTransaction(
  userCardId: string,
  cardId: string,
  benefits: DraftBenefit[],
  userCard: { statementDay: number | null; anniversaryDate: Date | null },
  annualFee: number | null,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Re-scrape replace-all is SCOPED to scraped rows (Task 80 / refines
    // CONSTRAINT-06): a user's manual benefits (source="manual") are pinned and
    // survive a re-scrape — only the previously-scraped set is replaced.
    await tx.benefit.deleteMany({ where: { userCardId, source: "scraped" } });
    for (const b of benefits) {
      // source="scraped" — these come from the scrape + LLM review gate (Task 80).
      await createBenefitWithPeriod(tx, userCardId, b, userCard, now, "scraped");
    }
    await tx.userCard.update({ where: { id: userCardId }, data: { lastVerifiedAt: now } });
    // CONSTRAINT-21 (Task 60): persist the reviewed annual fee on the shared
    // Card row, inside the SAME transaction as the benefit replacement. null is
    // allowed (not all cards expose a fee / user cleared it). Parameterized by
    // Prisma (SEC-03) — no raw SQL.
    await tx.card.update({ where: { id: cardId }, data: { annualFee } });
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

  const { userCardId, benefits, annualFee: rawAnnualFee } = body;
  if (!userCardId || typeof userCardId !== "string") {
    return NextResponse.json({ error: "userCardId is required" }, { status: 400 });
  }
  if (!Array.isArray(benefits) || benefits.length === 0) {
    return NextResponse.json({ error: "benefits must not be empty" }, { status: 400 });
  }
  const validationError = validateBenefits(benefits);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  // annualFee boundary validation (SEC-02 / EH-01): accept a finite number >= 0,
  // OR null, OR omitted (→ null). Reject anything else LOUDLY with context — no
  // silent coercion of negatives / NaN / strings.
  const annualFeeError = validateAnnualFee(rawAnnualFee);
  if (annualFeeError) return NextResponse.json({ error: annualFeeError }, { status: 400 });
  const annualFee: number | null =
    rawAnnualFee === undefined || rawAnnualFee === null ? null : (rawAnnualFee as number);

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
    await runConfirmTransaction(userCardId, userCard.cardId, benefits as DraftBenefit[], userCard, annualFee);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/benefits/confirm transaction error userCardId=${userCardId}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
