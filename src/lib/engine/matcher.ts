import type { BenefitModel } from "@/generated/prisma/models/Benefit";
import type { TransactionModel } from "@/generated/prisma/models/Transaction";

export type MatchedTransaction = TransactionModel & {
  matchedBenefitId: string | null;
  matchedRate: number | null;
};

/**
 * Matches each transaction to the highest-rate benefit by category.
 * If no category-specific benefit matches, falls back to the "general"
 * category benefit (base rate). If nothing matches, benefit is null.
 */
export function matchTransactionsToBenefits(
  transactions: TransactionModel[],
  benefits: BenefitModel[]
): MatchedTransaction[] {
  // Build a lookup: category → best benefit (highest rate)
  const categoryBestBenefit = buildCategoryMap(benefits);

  return transactions.map((tx) => {
    // Only match debits (positive amounts = money spent)
    if (tx.amount <= 0) {
      return { ...tx, matchedBenefitId: null, matchedRate: null };
    }

    const category = tx.assignedCategory;

    // Try exact category match first
    const match = categoryBestBenefit.get(category);
    if (match) {
      return {
        ...tx,
        matchedBenefitId: match.id,
        matchedRate: match.rate,
      };
    }

    // Fallback to "general" (base rate)
    const general = categoryBestBenefit.get("general");
    if (general) {
      return {
        ...tx,
        matchedBenefitId: general.id,
        matchedRate: general.rate,
      };
    }

    return { ...tx, matchedBenefitId: null, matchedRate: null };
  });
}

/**
 * Builds a map of category → benefit with the highest rate.
 * Only considers benefits that have a rate (points_multiplier, cashback).
 */
function buildCategoryMap(
  benefits: BenefitModel[]
): Map<string, BenefitModel> {
  const map = new Map<string, BenefitModel>();

  for (const benefit of benefits) {
    if (benefit.rate === null || benefit.category === null) continue;

    const existing = map.get(benefit.category);
    if (!existing || (benefit.rate > (existing.rate ?? 0))) {
      map.set(benefit.category, benefit);
    }
  }

  return map;
}

/**
 * Groups matched transactions by their matched benefit ID.
 * Useful for utilization calculation (sum amounts per benefit).
 */
export function groupByBenefit(
  matched: MatchedTransaction[]
): Map<string, MatchedTransaction[]> {
  const groups = new Map<string, MatchedTransaction[]>();

  for (const tx of matched) {
    if (!tx.matchedBenefitId) continue;
    const group = groups.get(tx.matchedBenefitId) ?? [];
    group.push(tx);
    groups.set(tx.matchedBenefitId, group);
  }

  return groups;
}
