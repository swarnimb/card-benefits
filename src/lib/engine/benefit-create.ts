import { prisma } from "@/lib/db";
import { calculatePeriodBoundary } from "@/lib/engine/periods";
import { deriveSetAndForget, deriveTracked, normalizeClassification } from "@/lib/parser/classification";
import type { DraftBenefit, BenefitSource } from "@/types/benefit";

const VALID_CATEGORIES = new Set(["dining", "travel", "streaming", "shopping", "lounge", "general", "wellness"]);

/**
 * Coerce an out-of-enum category to a valid one. The parser already clamps
 * Haiku's category at the LLM boundary, so this is a defense-in-depth backstop
 * for drafts parsed before that fix shipped (and any future client bug). Logs
 * loudly with context — never silently drops the bad value (EH-01). The manual
 * create path (Task 82) validates category strictly upstream, so this is a no-op
 * there; it only matters for scraped drafts.
 */
function coerceCategory(value: unknown): string {
  if (typeof value === "string" && VALID_CATEGORIES.has(value)) return value;
  console.warn(`[benefit-create] coerced out-of-enum category ${JSON.stringify(value)} -> "general"`);
  return "general";
}

// Prisma transaction client type, derived without importing the generated
// client (Prisma 7 generates to a non-default path on this project).
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Creates one benefit and, for tracked non-set-and-forget benefits, its initial
 * open BenefitPeriod. Shared by the scrape/review confirm route (Task 60/80) and
 * the manual create endpoint (Task 82). `tracked`/`setAndForget`/`source` are
 * server-derived in code, never trusted from the LLM/client:
 * - tracked: defaults to deriveTracked(classification); a client-supplied
 *   boolean WINS — the user's explicit review-gate override (Decision A,
 *   2026-05-26). classification itself stays server-only / non-editable.
 *   Excluded benefits are still persisted (tracked=false) — never dropped.
 * - setAndForget: a SUBSET of tracked (ANDed), so a benefit the user untracks
 *   also clears set-and-forget — we never persist the inconsistent
 *   (tracked=false, setAndForget=true) state. `activatedAt` is omitted; Prisma
 *   defaults it to null and CONSTRAINT-16 makes setBenefitActivation() its sole
 *   write path.
 * - source: SERVER-SET (Feature 11 / Task 80). Passed by the caller, never read
 *   from the client draft `b` — the scrape/review path passes "scraped"; the
 *   manual create endpoint (Task 82) passes "manual". Pins manual rows against
 *   re-scrape replace-all (refines CONSTRAINT-06).
 * - forceSetAndForgetOff: the manual path (Task 82) requires setAndForget=false
 *   unconditionally — a user-typed name that happens to match a membership
 *   pattern (e.g. "Walmart+ credit") must still be per-period tracked, because a
 *   manual benefit is an explicit user choice, not an LLM-inferred membership.
 *   The scraped path omits it (derives normally).
 *
 * SECURITY / allowlist write (Task 60): every column persisted to `Benefit` is
 * listed EXPLICITLY below — there is NO object spread of the client draft.
 * `confidence` and `note` (DraftBenefit, review-only) are intentionally omitted,
 * so they are impossible to write even if a client supplies them. Do NOT replace
 * this explicit field list with a spread of `b`.
 */
export async function createBenefitWithPeriod(
  tx: TransactionClient,
  userCardId: string,
  b: DraftBenefit,
  userCard: { statementDay: number | null; anniversaryDate: Date | null },
  now: Date,
  source: BenefitSource,
  forceSetAndForgetOff = false,
): Promise<string> {
  const tracked = typeof b.tracked === "boolean" ? b.tracked : deriveTracked(b.classification);
  const setAndForget =
    !forceSetAndForgetOff &&
    tracked && deriveSetAndForget(b.name, b.description ?? null, normalizeClassification(b.classification));
  // `ignoreRestSiblings` lets us name confidence/note in the rest-destructure
  // purely to document the exclusion without an unused-var lint error.
  const { confidence, note, ...allowlistedDraft } = b;
  void confidence; // review-only — never persisted (allowlist)
  void note; // review-only — never persisted (allowlist)
  const created = await tx.benefit.create({
    data: {
      userCardId,
      name: allowlistedDraft.name,
      description: allowlistedDraft.description ?? null,
      type: allowlistedDraft.type,
      value: allowlistedDraft.value ?? null,
      valueUnit: allowlistedDraft.valueUnit ?? "dollars",
      resetPeriod: allowlistedDraft.resetPeriod,
      resetAnchor: allowlistedDraft.resetAnchor,
      category: coerceCategory(allowlistedDraft.category),
      classification: normalizeClassification(allowlistedDraft.classification),
      // source is the SERVER-SUPPLIED argument (never `b.source`) — see allowlist note above.
      source,
      tracked,
      setAndForget,
    },
  });
  // CONSTRAINT-17: set-and-forget (and untracked) benefits get NO initial
  // BenefitPeriod. ensureCurrentPeriod short-circuits set-and-forget benefits,
  // so a period born here would be orphaned — never closed/rolled.
  if (!tracked || setAndForget) return created.id;

  // Fall back to calendar if the anchor requires data the card doesn't have.
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
  return created.id;
}
