import type { BenefitWithPeriod } from "./benefit";

/** Supported card issuers. */
export type Issuer =
  | "Chase"
  | "Amex"
  | "Capital One"
  | "Citi"
  | "Discover"
  | "Wells Fargo"
  | "Other";

/** A card from the static catalog (data/card-catalog.json). */
export interface CatalogCard {
  id: string;
  issuer: Issuer;
  name: string;
  scrapeUrl: string | null;
  defaultColor: string;
}

/** A user's card joined with its catalog card data. */
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

/** UserCardWithCard extended with current benefits and period data. */
export interface UserCardWithBenefits extends UserCardWithCard {
  benefits: BenefitWithPeriod[];
}
