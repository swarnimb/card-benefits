export type BenefitType = "credit" | "subscription" | "access" | "perk";

export type ResetPeriod = "monthly" | "quarterly" | "annual" | "once";

export type ResetAnchor = "calendar" | "statement" | "anniversary";

export type BenefitCategory =
  | "dining"
  | "travel"
  | "streaming"
  | "shopping"
  | "lounge"
  | "general";

export interface BenefitWithPeriod {
  id: string;
  userCardId: string;
  name: string;
  description: string | null;
  type: BenefitType;
  value: number | null;
  resetPeriod: ResetPeriod;
  resetAnchor: ResetAnchor;
  category: BenefitCategory;
  isTrackable: boolean;
  createdAt: Date;
  currentPeriod: {
    id: string;
    periodStart: Date;
    periodEnd: Date | null;
    usedAmount: number;
    status: string;
  } | null;
}

// Returned by the LLM parser — not yet saved to DB
export interface DraftBenefit {
  name: string;
  description: string | null;
  type: BenefitType;
  value: number | null;
  resetPeriod: ResetPeriod;
  resetAnchor: ResetAnchor;
  category: BenefitCategory;
  isTrackable: boolean;
  confidence: number;
}
