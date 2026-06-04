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
  /**
   * Scrape-derived annual fee in USD (Feature 9 / CONSTRAINT-21); null if not
   * parsed. Optional because the static add-card catalog (card-catalog.json)
   * does not carry it — it lives on the DB Card and is surfaced via the
   * /api/user-cards response.
   */
  annualFee?: number | null;
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
