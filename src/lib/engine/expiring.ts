import type { BenefitWithPeriod } from "@/types/benefit";
import type { UserCardWithBenefits } from "@/types/card";
import type { OverviewData } from "@/types/api";

/** Returns true if the benefit has unused value and its current period ends within daysThreshold. */
export function isExpiringSoon(benefit: BenefitWithPeriod, daysThreshold = 7): boolean {
  if (!benefit.isTrackable) return false;
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

type CardBreakdown = { cardName: string; cardColor: string; totalValue: number; totalUsed: number };
type CategoryEntry = { totalValue: number; totalUsed: number; cardCount: number; cardBreakdowns: Map<string, CardBreakdown> };

function newCategoryEntry(): CategoryEntry {
  return { totalValue: 0, totalUsed: 0, cardCount: 0, cardBreakdowns: new Map() };
}

function updateCardBreakdown(entry: CategoryEntry, card: UserCardWithBenefits, value: number, used: number): void {
  const bd = entry.cardBreakdowns.get(card.id) ?? { cardName: card.card.name, cardColor: card.card.defaultColor, totalValue: 0, totalUsed: 0 };
  bd.totalValue += value;
  bd.totalUsed += used;
  entry.cardBreakdowns.set(card.id, bd);
}

/** Builds the Overview space data: credit categories with per-card breakdowns + expiring alerts. */
export function aggregateOverview(cards: UserCardWithBenefits[]): OverviewData {
  const categoryMap = new Map<string, CategoryEntry>();
  const expiringSoon: OverviewData["expiringSoon"] = [];

  for (const card of cards) {
    for (const benefit of card.benefits) {
      if ((benefit.type === "credit" || benefit.type === "perk") && benefit.value !== null) {
        const entry = categoryMap.get(benefit.category) ?? newCategoryEntry();
        const used = benefit.currentPeriod?.usedAmount ?? 0;
        entry.totalValue += benefit.value;
        entry.totalUsed += used;
        entry.cardCount += 1;
        updateCardBreakdown(entry, card, benefit.value, used);
        categoryMap.set(benefit.category, entry);
      }

      if (isExpiringSoon(benefit) && benefit.currentPeriod?.periodEnd) {
        const remaining = benefit.type === "subscription"
          ? benefit.value ?? 0
          : (benefit.value ?? 0) - (benefit.currentPeriod.usedAmount);
        expiringSoon.push({
          benefitId: benefit.id,
          benefitName: benefit.name,
          userCardId: benefit.userCardId,
          cardName: card.card.name,
          cardColor: card.card.defaultColor,
          periodEnd: benefit.currentPeriod.periodEnd,
          remainingValue: remaining,
        });
      }
    }
  }

  const categories = Array.from(categoryMap.entries())
    .filter(([, v]) => v.totalValue > 0)
    .map(([category, v]) => ({ category, totalValue: v.totalValue, totalUsed: v.totalUsed, cardCount: v.cardCount, cards: Array.from(v.cardBreakdowns.values()) }));

  return { categories, expiringSoon };
}
