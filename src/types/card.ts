import type { BenefitWithPeriod } from "./benefit";

export type Issuer =
  | "Chase"
  | "Amex"
  | "Capital One"
  | "Citi"
  | "Discover"
  | "Wells Fargo"
  | "Other";

export interface CatalogCard {
  id: string;
  issuer: Issuer;
  name: string;
  scrapeUrl: string | null;
  defaultColor: string;
}

export interface UserCardWithCard {
  id: string;
  userId: string;
  cardId: string;
  displayOrder: number;
  lastVerifiedAt: Date | null;
  statementDay: number | null;
  anniversaryDate: Date | null;
  createdAt: Date;
  card: CatalogCard & { id: string };
}

export interface UserCardWithBenefits extends UserCardWithCard {
  benefits: BenefitWithPeriod[];
}
