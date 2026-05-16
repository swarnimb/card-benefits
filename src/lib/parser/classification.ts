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
