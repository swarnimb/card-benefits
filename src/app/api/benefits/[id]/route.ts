import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_TYPES = new Set(["credit", "subscription", "access", "perk"]);
const VALID_RESET_PERIODS = new Set(["monthly", "quarterly", "semiannual", "annual", "once"]);
const VALID_RESET_ANCHORS = new Set(["calendar", "statement", "anniversary"]);
const VALID_CATEGORIES = new Set(["dining", "travel", "streaming", "shopping", "lounge", "general", "wellness"]);

const VALID_VALUE_UNITS = new Set(["dollars", "points"]);

// Decision A (updated 2026-05-26): `tracked` is now user-editable post-save —
// it represents the user's override of the deterministic classification→tracked
// mapping. `classification` itself remains server-derived (not in this set).
const ALLOWED_PATCH_FIELDS = new Set([
  "name", "description", "type", "value", "valueUnit", "resetPeriod", "resetAnchor", "category", "tracked",
]);

type BenefitPatchData = {
  name?: string;
  description?: string | null;
  type?: string;
  value?: number | null;
  valueUnit?: string;
  resetPeriod?: string;
  resetAnchor?: string;
  category?: string;
  tracked?: boolean;
};

function parseJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  return request.json().then((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  }).catch(() => null);
}

function extractPatchFields(body: Record<string, unknown>): BenefitPatchData {
  const data: BenefitPatchData = {};
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (key in body) (data as Record<string, unknown>)[key] = body[key];
  }
  return data;
}

function validatePatchFields(data: BenefitPatchData): string | null {
  if (data.name !== undefined && (typeof data.name !== "string" || data.name.length === 0 || data.name.length > 200)) return "name must be a non-empty string (max 200 chars)";
  if (data.description !== undefined && data.description !== null && (typeof data.description !== "string" || data.description.length > 1000)) return "description must be a string (max 1000 chars) or null";
  if (data.type !== undefined && !VALID_TYPES.has(data.type)) return `invalid type: "${data.type}"`;
  if (data.value !== undefined && data.value !== null && (typeof data.value !== "number" || !Number.isFinite(data.value) || data.value < 0)) return "value must be a non-negative number or null";
  if (data.valueUnit !== undefined && !VALID_VALUE_UNITS.has(data.valueUnit)) return `invalid valueUnit: "${data.valueUnit}"`;
  if (data.resetPeriod !== undefined && !VALID_RESET_PERIODS.has(data.resetPeriod)) return `invalid resetPeriod: "${data.resetPeriod}"`;
  if (data.resetAnchor !== undefined && !VALID_RESET_ANCHORS.has(data.resetAnchor)) return `invalid resetAnchor: "${data.resetAnchor}"`;
  if (data.category !== undefined && !VALID_CATEGORIES.has(data.category)) return `invalid category: "${data.category}"`;
  if (data.tracked !== undefined && typeof data.tracked !== "boolean") return "tracked must be true or false";
  return null;
}

function fetchBenefitWithOwnership(id: string) {
  return prisma.benefit.findUnique({ where: { id }, include: { userCard: true } });
}

type BenefitUpdateContext = { type: string; resetPeriod: string; setAndForget: boolean; source: string };

function applyBenefitUpdate(id: string, patchData: BenefitPatchData, current: BenefitUpdateContext) {
  const typeChanged = patchData.type !== undefined && patchData.type !== current.type;
  const resetPeriodChanged =
    patchData.resetPeriod !== undefined && patchData.resetPeriod !== current.resetPeriod;

  // Edit-pin (Task 81, decision b): editing a scraped benefit converts it to
  // "manual" so a later re-scrape no longer replaces it (refines CONSTRAINT-06).
  // SERVER-DERIVED from the current row — `source` is never in ALLOWED_PATCH_FIELDS,
  // so it can't be set from the body. Already-manual rows are left unchanged.
  const writeData: BenefitPatchData & { source?: string } =
    current.source === "scraped" ? { ...patchData, source: "manual" } : patchData;

  // Set-and-forget benefits have no BenefitPeriod records (CONSTRAINT-17) — never touch periods.
  const touchesPeriods = !current.setAndForget && (typeChanged || resetPeriodChanged);
  if (!touchesPeriods) {
    return prisma.benefit.update({ where: { id }, data: writeData });
  }

  return prisma.$transaction(async (tx) => {
    const result = await tx.benefit.update({ where: { id }, data: writeData });
    if (typeChanged) {
      // Existing behavior: a type change resets the open period's usage.
      await tx.benefitPeriod.updateMany({
        where: { benefitId: id, status: "open" },
        data: { usedAmount: 0 },
      });
    }
    if (resetPeriodChanged) {
      // Close the stale open period (open→closed, the one permitted transition — CONSTRAINT-08).
      // The next read regenerates a correctly-bounded period via lazy ensureCurrentPeriod (CONSTRAINT-03).
      await tx.benefitPeriod.updateMany({
        where: { benefitId: id, status: "open" },
        data: { status: "closed" },
      });
    }
    return result;
  });
}

/** PATCH /api/benefits/[id] — Edits a single benefit's fields. Resets usage if type changes. */
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
    console.error(`PATCH /api/benefits/${id} lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!benefit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (benefit.userCard.userId !== getUserId()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const patchData = extractPatchFields(body);
  const validationError = validatePatchFields(patchData);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    const updated = await applyBenefitUpdate(id, patchData, {
      type: benefit.type,
      resetPeriod: benefit.resetPeriod,
      setAndForget: benefit.setAndForget,
      source: benefit.source,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`PATCH /api/benefits/${id} update error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/benefits/[id] — Removes a single benefit and its period history. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let benefit;
  try {
    benefit = await fetchBenefitWithOwnership(id);
  } catch (err) {
    console.error(`DELETE /api/benefits/${id} lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!benefit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (benefit.userCard.userId !== getUserId()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.benefit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/benefits/${id} delete error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
