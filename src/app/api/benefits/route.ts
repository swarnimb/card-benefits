import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createBenefitWithPeriod } from "@/lib/engine/benefit-create";
import { toBenefitWithPeriod } from "@/lib/engine/mappers";
import type { DraftBenefit } from "@/types/benefit";

const VALID_TYPES = new Set(["credit", "subscription", "access", "perk"]);
const VALID_RESET_PERIODS = new Set(["monthly", "quarterly", "semiannual", "annual", "once"]);
const VALID_CATEGORIES = new Set(["dining", "travel", "streaming", "shopping", "lounge", "general", "wellness"]);

const MAX_NAME_LENGTH = 200;

// Manual benefits default to a TRACKED bucket so they surface in Overview/Cards.
// Mirrors classification.ts DEFAULT_CLASSIFICATION; classification is server-set,
// never user-chosen — parity with the scrape path and PATCH (mass-assignment SEC).
const MANUAL_CLASSIFICATION = "discretionary-credit";

/** The allowlisted, validated shape of a manual-create request body. */
type ManualBenefitInput = {
  userCardId: string;
  name: string;
  value: number | null;
  resetPeriod: string;
  type: string;
  category: string;
};

type ValidationResult =
  | { ok: true; data: ManualBenefitInput }
  | { ok: false; error: string };

/**
 * Validates + allowlists a manual-create body. Only the six user-settable fields
 * are read; `source`/`tracked`/`setAndForget`/`classification`/`resetAnchor`/
 * `valueUnit` are server-set downstream and IGNORED here even if supplied (SEC:
 * mass-assignment defense — there is no spread of the body). `value` is the
 * per-reset-window figure (CONSTRAINT-24), non-negative or null (unlimited).
 * Returns a LOUD, context-bearing error string for any bad field (EH-01).
 */
function validateManualBenefit(body: Record<string, unknown>): ValidationResult {
  const { userCardId, name, value, resetPeriod, type, category } = body;
  if (typeof userCardId !== "string" || userCardId.length === 0) return { ok: false, error: "userCardId is required" };
  if (typeof name !== "string" || name.length === 0) return { ok: false, error: "name is required and must be a string" };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `name must be ${MAX_NAME_LENGTH} characters or less` };
  if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    return { ok: false, error: "value must be a non-negative number or null" };
  }
  if (!VALID_RESET_PERIODS.has(resetPeriod as string)) return { ok: false, error: `invalid resetPeriod: "${resetPeriod}"` };
  if (!VALID_TYPES.has(type as string)) return { ok: false, error: `invalid type: "${type}"` };
  if (!VALID_CATEGORIES.has(category as string)) return { ok: false, error: `invalid category: "${category}"` };
  // resetPeriod/type/category are proven valid strings by the Set.has checks above
  // (which don't narrow `unknown` for TS); userCardId/name narrowed by typeof.
  return {
    ok: true,
    data: {
      userCardId,
      name,
      value: (value as number | undefined) ?? null,
      resetPeriod: resetPeriod as string,
      type: type as string,
      category: category as string,
    },
  };
}

/**
 * Builds the server-controlled DraftBenefit for a manual create. Every
 * security-sensitive field (classification/tracked/setAndForget/source/anchor/
 * unit) is fixed here, never read from the request — `createBenefitWithPeriod`
 * receives "manual" + forceSetAndForgetOff and persists via its explicit allowlist.
 */
function toManualDraft(input: ManualBenefitInput): DraftBenefit {
  return {
    name: input.name,
    description: null,
    type: input.type as DraftBenefit["type"],
    value: input.value,
    valueUnit: "dollars",
    resetPeriod: input.resetPeriod as DraftBenefit["resetPeriod"],
    resetAnchor: "calendar",
    category: input.category as DraftBenefit["category"],
    classification: MANUAL_CLASSIFICATION as DraftBenefit["classification"],
    tracked: true,
    setAndForget: false,
    confidence: "high", // review-only field, stripped by the createBenefitWithPeriod allowlist — never persisted
  };
}

/**
 * POST /api/benefits — Creates ONE manual benefit directly (no scrape, no LLM,
 * no review gate). Manual data is user-typed, so it is exempt from CONSTRAINT-10
 * (which governs LLM-parsed benefits only). source="manual" pins it against
 * re-scrape (Task 80). Returns the created BenefitWithPeriod (201).
 */
export async function POST(request: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = validateManualBenefit(raw as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  let userCard;
  try {
    userCard = await prisma.userCard.findUnique({ where: { id: result.data.userCardId } });
  } catch (err) {
    console.error(`POST /api/benefits DB lookup error userCardId=${result.data.userCardId}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!userCard) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userCard.userId !== getUserId()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const draft = toManualDraft(result.data);
    const now = new Date();
    const createdId = await prisma.$transaction((tx) =>
      createBenefitWithPeriod(tx, result.data.userCardId, draft, userCard, now, "manual", true),
    );
    const benefit = await prisma.benefit.findUniqueOrThrow({ where: { id: createdId } });
    const period = await prisma.benefitPeriod.findFirst({
      where: { benefitId: createdId, status: "open" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(toBenefitWithPeriod(benefit, period), { status: 201 });
  } catch (err) {
    console.error(`POST /api/benefits create error userCardId=${result.data.userCardId}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
