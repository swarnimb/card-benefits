/** Aggregated overview data: credit categories with per-card breakdowns and expiring benefits. */
export interface OverviewData {
  categories: {
    category: string;
    totalValue: number;
    totalUsed: number;
    cardCount: number;
    cards: {
      cardName: string;
      cardColor: string;
      totalValue: number;
      totalUsed: number;
    }[];
  }[];
  expiringSoon: {
    benefitId: string;
    benefitName: string;
    userCardId: string;
    cardName: string;
    cardColor: string;
    periodEnd: Date;
    remainingValue: number;
  }[];
}
