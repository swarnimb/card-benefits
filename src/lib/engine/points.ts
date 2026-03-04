import type { BenefitModel } from "@/generated/prisma/models/Benefit";
import type { TransactionModel } from "@/generated/prisma/models/Transaction";
import type { PointsEstimate } from "@/types/card";
import { matchTransactionsToBenefits } from "./matcher";

/**
 * Estimates total points for a user card.
 *
 * Formula: baseline (user-entered) + estimated (from transactions after balance date)
 *
 * For estimated points:
 * - Match each transaction to the highest-rate benefit by category
 * - estimatedPoints per tx = amount × rate
 * - Sum all estimated points
 */
export function estimatePoints(
  pointBalance: number | null,
  pointBalanceUpdatedAt: Date | null,
  benefits: BenefitModel[],
  transactions: TransactionModel[]
): PointsEstimate {
  const baseline = pointBalance ?? 0;

  // Filter to points-earning benefits only
  const pointsBenefits = benefits.filter(
    (b) => b.type === "points_multiplier" && b.rate !== null
  );

  if (pointsBenefits.length === 0) {
    return {
      baseline: pointBalance,
      estimated: 0,
      total: baseline,
      balanceAsOf: pointBalanceUpdatedAt?.toISOString().split("T")[0] ?? null,
    };
  }

  // Filter transactions to only those after the balance date
  const relevantTx = pointBalanceUpdatedAt
    ? transactions.filter(
        (tx) => new Date(tx.date) > pointBalanceUpdatedAt
      )
    : transactions;

  // Match transactions to benefits
  const matched = matchTransactionsToBenefits(relevantTx, pointsBenefits);

  // Calculate estimated points
  let estimated = 0;
  for (const tx of matched) {
    if (tx.matchedRate !== null && tx.amount > 0) {
      estimated += tx.amount * tx.matchedRate;
    }
  }

  // Round to nearest whole point
  estimated = Math.round(estimated);

  return {
    baseline: pointBalance,
    estimated,
    total: baseline + estimated,
    balanceAsOf: pointBalanceUpdatedAt?.toISOString().split("T")[0] ?? null,
  };
}
