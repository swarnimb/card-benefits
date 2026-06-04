import type { BenefitType, BenefitCategory } from "@/types/benefit";
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
}

/** Portfolio-wide value figures for the Cards/Admin spaces (CONSTRAINT-18/19). Computed, never stored. */
export interface PortfolioStats {
  annualFeeTotal: number;
  redeemedYtd: number;
  available: number;
}
