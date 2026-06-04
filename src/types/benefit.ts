// Single source of truth for the bucket type + tracking policy lives in the
// parser module. Re-exported here so consumers can import it alongside the
// other benefit types.
import type { BenefitClassification } from "@/lib/parser/classification";
export type { BenefitClassification };

/** The four kinds of card benefit. */
export type BenefitType = "credit" | "subscription" | "access" | "perk";

/** How often a benefit resets. */
export type ResetPeriod = "monthly" | "quarterly" | "semiannual" | "annual" | "once";

/** What date the reset cycle is anchored to. */
export type ResetAnchor = "calendar" | "statement" | "anniversary";

/** Whether a benefit value is in dollars or loyalty points. */
export type ValueUnit = "dollars" | "points";

/** Spending/usage category for grouping benefits in the overview. */
export type BenefitCategory =
  | "dining"
  | "travel"
  | "streaming"
  | "shopping"
  | "lounge"
  | "general";

/** A benefit joined with its current period data — the primary shape used in API responses and UI. */
export interface BenefitWithPeriod {
  id: string;
  userCardId: string;
  name: string;
  description: string | null;
  type: BenefitType;
  value: number | null;
  valueUnit: ValueUnit;
  resetPeriod: ResetPeriod;
  resetAnchor: ResetAnchor;
  category: BenefitCategory;
  classification: BenefitClassification;
  tracked: boolean;
  setAndForget: boolean;
  activatedAt: Date | null;
  createdAt: Date;
  currentPeriod: {
    id: string;
    periodStart: Date;
    periodEnd: Date | null;
    usedAmount: number;
    status: string;
  } | null;
}

/**
 * Full result of a Haiku parse: the draft benefits plus the card-level annual
 * fee (USD, null when not found — A11 fallback). Task 58 surfaces annualFee;
 * persistence is deferred to Task 60 (review gate + DB write).
 */
export interface ParseResult {
  benefits: DraftBenefit[];
  annualFee: number | null;
}

/** Returned by the LLM parser — not yet saved to DB. Requires user confirmation before persisting. */
export interface DraftBenefit {
  name: string;
  description: string | null;
  type: BenefitType;
  value: number | null;
  valueUnit: ValueUnit;
  resetPeriod: ResetPeriod;
  resetAnchor: ResetAnchor;
  category: BenefitCategory;
  classification: BenefitClassification;
  tracked: boolean;
  setAndForget: boolean;
  /**
   * REVIEW-TIME ONLY — never persisted. Deterministic tier derived in code from
   * Haiku's numeric confidence score via `toConfidenceTier` (NOT decided by the
   * LLM). Drives the review-gate "low confidence" flag. Task 60 strips this
   * before any Prisma write — it must never reach the `benefits` table.
   */
  confidence: "high" | "low";
  /**
   * REVIEW-TIME ONLY — never persisted. Optional reviewer-facing note from Haiku
   * about anything ambiguous; undefined when omitted. Like `confidence`, Task 60
   * strips this before persistence — it must never reach the DB.
   */
  note?: string;
}
