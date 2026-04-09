export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface OverviewData {
  categories: {
    category: string;
    totalValue: number;
    totalUsed: number;
    cardCount: number;
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
