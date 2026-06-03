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
 * Deterministic regex overrides. The LLM picks one of the five classification
 * buckets; this module corrects obvious misclassifications by matching the
 * benefit name + description against narrow regex sets and flipping to the
 * correct bucket. Each pattern set is intentionally narrow to avoid false
 * positives — false negatives (under-correction) are safer than false positives
 * (over-correction) because the review gate is the final defense.
 *
 * Coverage (each one closes a specific NEW-* defect):
 *   - Auto-earn:     cash-back %, points/miles multipliers   (Task 44 / NEW-5)
 *   - Trial:         "trial" anywhere in name/description    (Task 48 / NEW-8)
 *   - Pay-over-time: financing features                      (Task 48 / NEW-8)
 *   - Discount:      auto-applied / recurring discounts      (Task 48 / NEW-8)
 */

/** Cash-back % and Nx points/miles multipliers → auto-earn (Task 44 / NEW-5). */
const CASH_BACK_RATE_PATTERN =
  /\b\d+(\.\d+)?%\s*(cash\s*back|back|rewards?|on\s+all|on\s+every)/i;
const POINTS_MILES_RATE_PATTERN = /\b\d+x\s*(points?|miles?)\s*on/i;

/** Free-trial / signup-perk phrasings → one-time-bonus (Task 48 / NEW-8). */
const TRIAL_PATTERN = /\btrial\b/i;

/** Card-feature financing, never a claimable credit → passive-perk (Task 48 / NEW-8). */
const PAY_OVER_TIME_PATTERN = /pay\s+over\s+time/i;

/**
 * Auto-applied or recurring discounts → passive-perk (Task 48 / NEW-8).
 * Bare "discount" is too ambiguous (a card might describe a fixed-dollar credit
 * as "$10 dining discount"), so we only flip when the phrasing explicitly
 * signals auto-application or a fixed cadence prefix. Locked by negative tests
 * against the obvious false-positives ("$25 dining credit").
 */
const AUTO_APPLIED_DISCOUNT_PATTERN = /\bauto[-\s]applied\s+discount\b/i;
const RECURRING_DISCOUNT_PATTERN = /\b(quarterly|monthly|annual)\s+discount\b/i;

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

/** True if the name or description contains "trial" — signup-perk signal. */
export function detectTrialPatterns(
  name: string,
  description: string | null
): boolean {
  const text = `${name} ${description ?? ""}`;
  return TRIAL_PATTERN.test(text);
}

/** True if the benefit text mentions "pay over time" — financing feature. */
export function detectPayOverTimePatterns(
  name: string,
  description: string | null
): boolean {
  const text = `${name} ${description ?? ""}`;
  return PAY_OVER_TIME_PATTERN.test(text);
}

/** True if the benefit text signals an auto-applied or recurring discount. */
export function detectDiscountPatterns(
  name: string,
  description: string | null
): boolean {
  const text = `${name} ${description ?? ""}`;
  return (
    AUTO_APPLIED_DISCOUNT_PATTERN.test(text) ||
    RECURRING_DISCOUNT_PATTERN.test(text)
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
 * Override dispatch table. Order = priority — the first rule that matches
 * wins. Auto-earn is first because a literal cash-back % is the strongest
 * signal (almost never refers to a discretionary credit). Discount is last
 * because it has the broadest false-positive surface.
 */
const OVERRIDE_RULES: readonly {
  detect: (name: string, description: string | null) => boolean;
  target: BenefitClassification;
  reason: string;
}[] = [
  { detect: detectAutoEarnPatterns, target: "auto-earn", reason: "earn-rate regex" },
  { detect: detectTrialPatterns, target: "one-time-bonus", reason: "trial regex" },
  { detect: detectPayOverTimePatterns, target: "passive-perk", reason: "pay-over-time regex" },
  { detect: detectDiscountPatterns, target: "passive-perk", reason: "auto-applied/recurring discount regex" },
];

/**
 * Returns the final classification bucket after applying deterministic
 * overrides. The LLM's bucket wins unless one of the OVERRIDE_RULES detects an
 * obvious misclassification — first match wins, in priority order. Each
 * override flip logs at debug level (EH-01 not silent); a no-op when the LLM
 * already chose the override target.
 *
 * Auto-earn is sticky: once the LLM identifies a passive earn rate, no weaker
 * keyword signal ("trial", "discount") downgrades it. This handles edge cases
 * like "5% cash back trial offer" — the cash-back mechanic is the truth.
 */
export function applyClassificationOverride(
  name: string,
  description: string | null,
  classification: BenefitClassification
): BenefitClassification {
  if (classification === "auto-earn") return classification;
  for (const rule of OVERRIDE_RULES) {
    if (!rule.detect(name, description)) continue;
    if (classification === rule.target) return classification;
    debugLog(
      `override: "${name}" classification "${classification}" → "${rule.target}" (matched ${rule.reason})`
    );
    return rule.target;
  }
  return classification;
}

/* ── Set-and-forget detection (Task 50 / Feature 8) ──────────────────────────
 * Membership-reimbursement benefits the cardholder enrolls in ONCE, after which
 * the statement credit applies automatically every period with no recurring
 * action. They are still tracked, but they need no period-by-period usage nudge
 * (they render in the "Automatic" group, Task 54). The set is a deliberate
 * allow-list of known products, mirroring the narrow detect* pattern above.
 *
 * The failure tradeoff is the INVERSE of the override rules: a false positive
 * would suppress usage tracking on a spend-it-or-lose-it credit (a missed-money
 * risk), so under-matching is the safer error — we only flip on a recognised
 * membership token, never on bare "membership"/"credit" phrasing.
 *
 * Uber One vs Uber Cash is the canonical trap: Uber One is a paid membership the
 * card reimburses (set-and-forget); Uber Cash is a monthly balance the user must
 * actively spend (NOT set-and-forget). The pattern matches only the membership.
 */
const SET_AND_FORGET_PATTERNS: readonly RegExp[] = [
  /\bwalmart\s*(?:\+|plus\b)/i, // Walmart+ membership (no \b after "+": it is a non-word char)
  /\buber\s+one\b/i, // Uber One membership — NOT Uber Cash
  /\bclear\s*(?:®\s*)?plus\b/i, // CLEAR Plus (the paid airport-security membership)
  /\bclear\b(?=[^.]{0,40}\b(?:credit|membership)\b)/i, // "CLEAR ... credit/membership" without the "Plus" wording
  /\boura\b/i, // Oura Ring membership
  /\b(?:digital\s+entertainment|streaming\s+bundle)\b/i, // bundled streaming/entertainment credits
];

/**
 * True when `name` + `description` names a known membership-reimbursement
 * benefit (Walmart+, Uber One, CLEAR / CLEAR Plus, Oura, digital-entertainment /
 * streaming-bundle credits). Concatenates both fields before testing so a match
 * in either triggers — mirrors `detectAutoEarnPatterns` et al.
 */
export function detectSetAndForget(
  name: string,
  description: string | null
): boolean {
  const text = `${name} ${description ?? ""}`;
  return SET_AND_FORGET_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Deterministic set-and-forget resolution. Like `deriveTracked`, the LLM may
 * hint (membership reimbursements steer toward the `activation-perk` bucket via
 * the tool schema) but CODE decides. Two gates, both required:
 *   1. The benefit must be tracked — an excluded benefit (auto-earn /
 *      passive-perk / one-time-bonus, including a Walmart+ *trial* the override
 *      flipped to one-time-bonus) is never a standing membership reimbursement.
 *   2. Its name/description must match the known membership-reimbursement set.
 * Logs the positive decision at debug level (EH-01 not silent / EH-02 context).
 */
export function deriveSetAndForget(
  name: string,
  description: string | null,
  classification: BenefitClassification
): boolean {
  if (!deriveTracked(classification)) return false;
  if (!detectSetAndForget(name, description)) return false;
  debugLog(`setAndForget: "${name}" → true (matched membership-reimbursement set)`);
  return true;
}
