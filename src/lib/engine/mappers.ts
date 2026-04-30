import type { Benefit, BenefitPeriod } from "@prisma/client";
import type { BenefitWithPeriod, BenefitType, ValueUnit, ResetPeriod, ResetAnchor, BenefitCategory } from "@/types/benefit";

/** Maps a Prisma Benefit + optional BenefitPeriod to the API-facing BenefitWithPeriod shape. */
export function toBenefitWithPeriod(benefit: Benefit, period: BenefitPeriod | null): BenefitWithPeriod {
  return {
    id: benefit.id,
    userCardId: benefit.userCardId,
    name: benefit.name,
    description: benefit.description,
    type: benefit.type as BenefitType,
    value: benefit.value,
    valueUnit: (benefit.valueUnit ?? "dollars") as ValueUnit,
    resetPeriod: benefit.resetPeriod as ResetPeriod,
    resetAnchor: benefit.resetAnchor as ResetAnchor,
    category: benefit.category as BenefitCategory,
    isTrackable: benefit.isTrackable,
    createdAt: benefit.createdAt,
    currentPeriod: period
      ? { id: period.id, periodStart: period.periodStart, periodEnd: period.periodEnd, usedAmount: period.usedAmount, status: period.status }
      : null,
  };
}
