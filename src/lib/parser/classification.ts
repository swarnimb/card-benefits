/**
 * Deterministic classification → tracked policy. The LLM assigns the
 * `classification` bucket; this module — never the model, prompt, or routes —
 * decides whether a benefit is tracked. Pure: no DB/LLM/fetch/Prisma.
 */

/** The five benefit classification buckets the LLM assigns. */
export type BenefitClassification =
  | "discretionary-credit"
  | "activation-perk"
  | "auto-earn"
  | "passive-perk"
  | "one-time-bonus";

/** All valid buckets, for validation and iteration. */
export const CLASSIFICATION_BUCKETS: readonly BenefitClassification[] = [
  "discretionary-credit",
  "activation-perk",
  "auto-earn",
  "passive-perk",
  "one-time-bonus",
] as const;

/** Buckets tracked by default. Excluded buckets are persisted, never dropped. */
const TRACKED_BUCKETS: ReadonlySet<BenefitClassification> = new Set([
  "discretionary-credit",
  "activation-perk",
]);

/** Conservative default: ambiguous → tracked (A10 false-exclusion mitigation). */
const DEFAULT_CLASSIFICATION: BenefitClassification = "discretionary-credit";

/** Narrows an unknown value to a valid classification bucket. */
export function isValidClassification(
  value: unknown
): value is BenefitClassification {
  return (
    typeof value === "string" &&
    (CLASSIFICATION_BUCKETS as readonly string[]).includes(value)
  );
}

/** Valid bucket passes through; anything else → conservative default. */
export function normalizeClassification(value: unknown): BenefitClassification {
  return isValidClassification(value) ? value : DEFAULT_CLASSIFICATION;
}

/**
 * Policy map: discretionary-credit/activation-perk → true; the rest → false.
 * Normalizes first so unknown/ambiguous input resolves to a tracked default.
 */
export function deriveTracked(classification: unknown): boolean {
  return TRACKED_BUCKETS.has(normalizeClassification(classification));
}

/**
 * Patterns that obviously denote passive earn rates (cash-back percentages and
 * points/miles multipliers). Used by `applyAutoEarnOverride` to correct LLM
 * misclassifications of earn rates as user-claimable credits (Task 44 / NEW-5).
 * Intentionally narrow — only matches phrasings that cannot plausibly be
 * discretionary credits, to avoid flipping bonus-category dollar credits.
 */
const CASH_BACK_RATE_PATTERN =
  /\b\d+(\.\d+)?%\s*(cash\s*back|back|rewards?|on\s+all|on\s+every)/i;
const POINTS_MILES_RATE_PATTERN = /\b\d+x\s*(points?|miles?)\s*on/i;

/**
 * Returns true if `name` + `description` contains an obvious earn-rate
 * phrasing. Concatenates the two before testing so a match in either field
 * triggers, which mirrors how Haiku splits the same benefit across both.
 */
export function detectAutoEarnPatterns(
  name: string,
  description: string | null
): boolean {
  const text = `${name} ${description ?? ""}`;
  return (
    CASH_BACK_RATE_PATTERN.test(text) ||
    POINTS_MILES_RATE_PATTERN.test(text)
  );
}

/**
 * Gated debug log. Visible only when `DEBUG=true` in the environment so normal
 * runs stay quiet but override decisions remain observable on demand (EH-01
 * not-silent + EH-02 context). Not a magic log — explicit prefix + reason.
 */
function debugLog(message: string): void {
  if (process.env.DEBUG === "true") {
    console.log(`[classification] ${message}`);
  }
}

/**
 * Returns the final classification bucket. When the LLM picked something other
 * than `auto-earn` but the name/description matches an obvious earn-rate
 * pattern, override to `auto-earn` — the deterministic correction for NEW-5
 * (Haiku classifying Freedom Unlimited cash-back rates as discretionary
 * credits). The LLM's bucket wins for everything that does not match.
 */
export function applyAutoEarnOverride(
  name: string,
  description: string | null,
  classification: BenefitClassification
): BenefitClassification {
  if (classification === "auto-earn") return classification;
  if (!detectAutoEarnPatterns(name, description)) return classification;
  debugLog(
    `override: "${name}" classification "${classification}" → "auto-earn" (matched earn-rate regex)`
  );
  return "auto-earn";
}
