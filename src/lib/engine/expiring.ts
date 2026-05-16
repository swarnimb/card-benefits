import type { BenefitWithPeriod } from "@/types/benefit";
import type { UserCardWithBenefits } from "@/types/card";
import type { OverviewBenefit, OverviewData } from "@/types/api";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns true if the benefit has unused value and its current period ends within daysThreshold. */
export function isExpiringSoon(benefit: BenefitWithPeriod, daysThreshold = 7): boolean {
  if (!benefit.tracked) return false;
  if (benefit.resetPeriod === "once") return false;

  const { currentPeriod } = benefit;
  if (!currentPeriod?.periodEnd) return false;

  const cutoff = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
  if (currentPeriod.periodEnd > cutoff) return false;

  const { type, value } = benefit;
  const used = currentPeriod.usedAmount;

  if (type === "credit" || type === "perk") return value !== null && used < value;
  if (type === "subscription") return used === 0;
  if (type === "access") return value !== null && used < value;
  return false;
}

/** Whole days from now until periodEnd, floored at 0. Null for `once` benefits / no open period. */
function daysUntilReset(periodEnd: Date | null | undefined, now: number): number | null {
  if (!periodEnd) return null;
  return Math.max(0, Math.ceil((periodEnd.getTime() - now) / MS_PER_DAY));
}

/** Unredeemed value this period. 0 for unlimited (value === null) or already-consumed benefits. */
function unusedValue(benefit: BenefitWithPeriod): number {
  const used = benefit.currentPeriod?.usedAmount ?? 0;
  if (benefit.type === "subscription") return used === 0 ? benefit.value ?? 0 : 0;
  if (benefit.value === null) return 0;
  return Math.max(0, benefit.value - used);
}

/** True when no further action is possible this period: cap reached, or subscription already used. */
function isDone(benefit: BenefitWithPeriod): boolean {
  const used = benefit.currentPeriod?.usedAmount ?? 0;
  if (benefit.type === "subscription") return used > 0;
  if (benefit.value === null) return false; // unlimited — always actionable
  return used >= benefit.value;
}

function toOverviewRow(
  benefit: BenefitWithPeriod,
  card: UserCardWithBenefits,
  now: number,
): OverviewBenefit {
  return {
    benefitId: benefit.id,
    benefitName: benefit.name,
    cardName: card.card.name,
    issuer: card.card.issuer,
    cardColor: card.card.defaultColor,
    type: benefit.type,
    category: benefit.category,
    unusedAmount: unusedValue(benefit),
    daysUntilReset: daysUntilReset(benefit.currentPeriod?.periodEnd, now),
  };
}

/**
 * Buckets every tracked benefit by urgency (NOT by type/category):
 * - needsAttention: unused value that resets soon (isExpiringSoon)
 * - done: cap reached or subscription already used this period
 * - onTrack: still actionable, not urgent
 *
 * tracked:false benefits never enter any bucket. `moneyAtRisk` sums the unredeemed
 * value across needsAttention and reports the soonest reset among them.
 */
export function buildOverviewTriage(cards: UserCardWithBenefits[]): OverviewData {
  const now = Date.now();
  const needsAttention: OverviewBenefit[] = [];
  const onTrack: OverviewBenefit[] = [];
  const done: OverviewBenefit[] = [];

  for (const card of cards) {
    for (const benefit of card.benefits) {
      if (!benefit.tracked) continue; // excluded benefits never surface (A10 / CONSTRAINT)
      const row = toOverviewRow(benefit, card, now);
      if (isExpiringSoon(benefit)) needsAttention.push(row);
      else if (isDone(benefit)) done.push(row);
      else onTrack.push(row);
    }
  }

  needsAttention.sort((a, b) => (a.daysUntilReset ?? 0) - (b.daysUntilReset ?? 0));

  const totalUnredeemed = needsAttention.reduce((sum, r) => sum + r.unusedAmount, 0);
  const soonestDaysUntilReset =
    needsAttention.length > 0 ? needsAttention[0].daysUntilReset : null;

  return {
    moneyAtRisk: { totalUnredeemed, soonestDaysUntilReset },
    needsAttention,
    onTrack,
    done,
  };
}
