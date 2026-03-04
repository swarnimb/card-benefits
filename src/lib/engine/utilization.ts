import type { BenefitModel } from "@/generated/prisma/models/Benefit";
import type { TransactionModel } from "@/generated/prisma/models/Transaction";
import type { BenefitWithUtilization } from "@/types/card";

type PeriodWindow = {
  start: Date;
  end: Date;
};

/**
 * Calculates utilization for a single trackable benefit.
 * Finds the current period window, sums matching transactions, returns utilization data.
 */
export function calculateUtilization(
  benefit: BenefitModel,
  transactions: TransactionModel[],
  referenceDate: Date = new Date()
): BenefitWithUtilization {
  // Display-only benefits have no utilization
  if (benefit.trackingType !== "trackable" || benefit.capAmount === null) {
    return { ...benefit, utilization: null };
  }

  const period = getCurrentPeriod(
    benefit.capPeriod as string,
    benefit.resetMonth ?? 1,
    referenceDate
  );

  // Filter transactions to current period + matching category
  // Note: "general" catch-all only applies to uncapped benefits (e.g. 1X base rate).
  // Capped benefits (like "$10 DoorDash Credit") must match their specific category.
  const matchingTx = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return (
      tx.amount > 0 &&
      txDate >= period.start &&
      txDate <= period.end &&
      tx.assignedCategory === benefit.category
    );
  });

  const amountUsed = matchingTx.reduce((sum, tx) => sum + tx.amount, 0);
  const percentage =
    benefit.capAmount > 0
      ? Math.min((amountUsed / benefit.capAmount) * 100, 100)
      : null;

  return {
    ...benefit,
    utilization: {
      periodStart: period.start.toISOString().split("T")[0],
      periodEnd: period.end.toISOString().split("T")[0],
      amountUsed: Math.round(amountUsed * 100) / 100,
      capAmount: benefit.capAmount,
      percentage: percentage !== null ? Math.round(percentage * 10) / 10 : null,
    },
  };
}

/**
 * Calculates utilization for all benefits of a card.
 */
export function calculateAllUtilizations(
  benefits: BenefitModel[],
  transactions: TransactionModel[],
  referenceDate: Date = new Date()
): BenefitWithUtilization[] {
  return benefits.map((b) =>
    calculateUtilization(b, transactions, referenceDate)
  );
}

/**
 * Determines the current period window (start/end dates) based on
 * capPeriod and resetMonth.
 *
 * - monthly: 1st of current month → last day of current month
 * - quarterly: uses resetMonth to determine quarter start months
 *   (e.g. resetMonth=1 → Jan/Apr/Jul/Oct quarters)
 * - annual: resetMonth → resetMonth of next year
 */
function getCurrentPeriod(
  capPeriod: string,
  resetMonth: number,
  referenceDate: Date
): PeriodWindow {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1-based

  if (capPeriod === "monthly") {
    const start = new Date(year, month - 1, 1); // first of month
    const end = new Date(year, month, 0, 23, 59, 59, 999); // last of month
    return { start, end };
  }

  if (capPeriod === "quarterly") {
    // Quarters start at resetMonth, resetMonth+3, resetMonth+6, resetMonth+9
    const quarterStarts = [0, 3, 6, 9].map((offset) => {
      let m = ((resetMonth - 1 + offset) % 12) + 1;
      return m;
    });

    // Find which quarter we're in
    let quarterStart = quarterStarts[0];
    let quarterYear = year;

    for (let i = quarterStarts.length - 1; i >= 0; i--) {
      const qMonth = quarterStarts[i];
      if (month >= qMonth) {
        quarterStart = qMonth;
        break;
      }
    }

    // Handle case where reset month is later in year and we haven't reached it
    if (month < quarterStarts[0]) {
      quarterStart = quarterStarts[quarterStarts.length - 1];
      quarterYear = year - 1;
    }

    const start = new Date(quarterYear, quarterStart - 1, 1);
    const endMonth = quarterStart + 2; // 3 months in a quarter
    const endYear = endMonth > 12 ? quarterYear + 1 : quarterYear;
    const adjustedEndMonth = endMonth > 12 ? endMonth - 12 : endMonth;
    const end = new Date(endYear, adjustedEndMonth, 0, 23, 59, 59, 999);

    return { start, end };
  }

  if (capPeriod === "annual") {
    // Annual period: resetMonth of this year → resetMonth of next year
    let periodYear = year;
    if (month < resetMonth) {
      periodYear = year - 1;
    }

    const start = new Date(periodYear, resetMonth - 1, 1);
    const end = new Date(periodYear + 1, resetMonth - 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  // Fallback: calendar year
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}
