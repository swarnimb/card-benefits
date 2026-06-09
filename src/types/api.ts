import type { BenefitType, BenefitCategory, ResetPeriod } from "@/types/benefit";
import type { Issuer } from "@/types/card";

/**
 * A single benefit row as surfaced in the Overview triage buckets.
 * Keyed by urgency (needsAttention / onTrack / done), not by type or category.
 */
export interface OverviewBenefit {
  benefitId: string;
  benefitName: string;
  cardName: string;
  issuer: Issuer;
  cardColor: string;
  type: BenefitType;
  category: BenefitCategory;
  /** Unredeemed value this period. 0 for unlimited (value === null) or already-used benefits. */
  unusedAmount: number;
  /** Whole days until the current period ends; null for `once` benefits or no open period. */
  daysUntilReset: number | null;
  /** userCard id — for distinct-card counting + UI keys. */
  cardId: string;
  /** Dollar cap (the design's `amt`); null = unlimited. */
  value: number | null;
  /** Used this period. */
  usedAmount: number;
  /** Cadence label source. */
  resetPeriod: ResetPeriod;
  /** Activate-once benefit with no period (CONSTRAINT-17) — info-only on Overview, no usage logging. */
  setAndForget: boolean;
}

/** One of the 4 Overview display groups credits are bucketed into. */
export type OverviewCategoryGroup = "Travel" | "Dining" | "Lifestyle" | "Wellness";

/** One credit's slice of the hero sparkbar (proportional to its unredeemed value). */
export interface SparkbarSegment {
  benefitId: string;
  issuerColor: string; // = the credit's cardColor
  weight: number;      // unusedAmount / total at-risk (0..1)
  remaining: number;   // unusedAmount (for the segment tooltip)
}

/** Active credits for one of the 4 Overview display groups (onTrack set only). */
export interface CategoryGroup {
  group: OverviewCategoryGroup;
  credits: OverviewBenefit[]; // sorted by unusedAmount desc
  totalRemaining: number;     // Σ unusedAmount
  totalUsed: number;          // Σ usedAmount
  totalValue: number;         // Σ (value ?? 0)
  creditCount: number;
  cardCount: number;          // distinct cardId
}

/** Headline "money left on the table that resets soon" figure for the Overview hero. */
export interface OverviewMoneyAtRisk {
  /** Sum of unusedAmount across every expiring-soon (needsAttention) benefit. */
  totalUnredeemed: number;
  /** Soonest daysUntilReset among needsAttention benefits; null when none are at risk. */
  soonestDaysUntilReset: number | null;
}

/**
 * Aggregated overview data — urgency triage. Cards/Admin spaces are unaffected.
 * tracked:false benefits never appear in any bucket (PRD F6 / Feature 3.5).
 */
export interface OverviewData {
  moneyAtRisk: OverviewMoneyAtRisk;
  needsAttention: OverviewBenefit[];
  onTrack: OverviewBenefit[];
  done: OverviewBenefit[];
  /** Active credits grouped into the 4 Overview display groups (onTrack set). */
  activeByCategory: CategoryGroup[];
  /** Proportional hero sparkbar segments built from the needsAttention set. */
  sparkbar: SparkbarSegment[];
}

/** Portfolio-wide value figures for the Cards/Admin spaces (CONSTRAINT-18/19). Computed, never stored. */
export interface PortfolioStats {
  annualFeeTotal: number;
  redeemedYtd: number;
  available: number;
}
