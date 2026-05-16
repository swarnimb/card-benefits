// Single source of truth for the bucket type + tracking policy lives in the
// parser module. Re-exported here so consumers can import it alongside the
// other benefit types.
import type { BenefitClassification } from "@/lib/parser/classification";
export type { BenefitClassification };

/** The four kinds of card benefit. */
export type BenefitType = "credit" | "subscription" | "access" | "perk";

/** How often a benefit resets. */
export type ResetPeriod = "monthly" | "quarterly" | "annual" | "once";

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
  createdAt: Date;
  currentPeriod: {
    id: string;
    periodStart: Date;
    periodEnd: Date | null;
    usedAmount: number;
    status: string;
  } | null;
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
  confidence: number;
}
