import type { CardModel } from "@/generated/prisma/models/Card";
import type { BenefitModel } from "@/generated/prisma/models/Benefit";
import type { UserCardModel } from "@/generated/prisma/models/UserCard";

// --- String literal unions for DB string fields ---

export type CardNetwork = "visa" | "mastercard" | "amex";

export type BenefitType =
  | "cashback"
  | "points_multiplier"
  | "statement_credit"
  | "perk";

export type TrackingType = "trackable" | "display_only";

export type RateType = "percentage" | "multiplier";

export type CapPeriod = "monthly" | "quarterly" | "annual";

export type BenefitCategory =
  | "dining"
  | "travel"
  | "groceries"
  | "gas"
  | "streaming"
  | "entertainment"
  | "drugstore"
  | "transit"
  | "general";

// --- API response types (models with relations) ---

export type CardWithBenefits = CardModel & {
  benefits: BenefitModel[];
};

export type UserCardWithCard = UserCardModel & {
  card: CardWithBenefits;
};

// --- Utilization (computed by engine, returned by benefits API) ---

export type BenefitWithUtilization = BenefitModel & {
  utilization: {
    periodStart: string;
    periodEnd: string;
    amountUsed: number;
    capAmount: number | null;
    percentage: number | null; // null if uncapped
  } | null; // null if display_only
};

export type PointsEstimate = {
  baseline: number | null; // user-entered balance
  estimated: number; // calculated from transactions
  total: number; // baseline + estimated
  balanceAsOf: string | null; // ISO date of last manual update
};

export type CardBenefitsResponse = {
  userCard: UserCardModel;
  card: CardModel;
  benefits: BenefitWithUtilization[];
  points: PointsEstimate;
};

// --- Seed data format (JSON files in data/cards/) ---

export type SeedBenefit = {
  name: string;
  description: string;
  type: BenefitType;
  trackingType: TrackingType;
  category?: BenefitCategory;
  rate?: number;
  rateType?: RateType;
  capAmount?: number;
  capPeriod?: CapPeriod;
  resetMonth?: number;
  externalUrl?: string;
};

export type SeedCard = {
  bankName: string;
  cardName: string;
  cardType: CardNetwork;
  annualFee: number;
  imageColor: string;
  benefits: SeedBenefit[];
};
