import type { BenefitWithPeriod, BenefitCategory, BenefitType } from "@/types/benefit";
import type { UserCardWithBenefits } from "@/types/card";
import type {
  OverviewBenefit,
  OverviewData,
  OverviewCategoryGroup,
  CategoryGroup,
  SparkbarSegment,
} from "@/types/api";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns true if the benefit has unused value and its current period ends within daysThreshold. */
export function isExpiringSoon(benefit: BenefitWithPeriod, daysThreshold = 7): boolean {
  if (!benefit.tracked) return false;
  // Set-and-forget benefits never "expire soon" — they have no per-period reset
  // (CONSTRAINT-17). Active → realized; not-set-up → calm. Neither is urgent.
  if (benefit.setAndForget) return false;
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

/**
 * Unredeemed value from a benefit's parts. Shared so the Overview client's
 * optimistic recompute (`use-overview-data.ts`) derives the same figure the
 * server does. subscription: full value until claimed; unlimited (value null): 0;
 * capped: value − used, floored at 0.
 */
export function unusedFromParts(
  type: BenefitType,
  value: number | null,
  used: number,
): number {
  if (type === "subscription") return used === 0 ? value ?? 0 : 0;
  if (value === null) return 0;
  return Math.max(0, value - used);
}

/** Unredeemed value this period. 0 for unlimited (value === null) or already-consumed benefits. */
function unusedValue(benefit: BenefitWithPeriod): number {
  // Set-and-forget benefits carry no money-at-risk: active ones are realized,
  // not-set-up ones are deliberately kept calm on the Overview (their activation
  // prompt lives in the Cards-space "Automatic" group, not as Overview urgency).
  if (benefit.setAndForget) return 0;
  return unusedFromParts(
    benefit.type,
    benefit.value,
    benefit.currentPeriod?.usedAmount ?? 0,
  );
}

/** True when no further action is possible this period: cap reached, or subscription already used. */
function isDone(benefit: BenefitWithPeriod): boolean {
  // An ACTIVE set-and-forget benefit is fully realized — treat as done. A
  // not-set-up one still has an action (activate it), so it falls through to
  // onTrack (calm, non-urgent), never needsAttention.
  if (benefit.setAndForget) return benefit.activatedAt !== null;
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
    cardId: card.id,
    value: benefit.value,
    usedAmount: benefit.currentPeriod?.usedAmount ?? 0,
    resetPeriod: benefit.resetPeriod,
    setAndForget: benefit.setAndForget,
  };
}

/**
 * Maps a benefit's source category onto one of the 4 Overview display groups.
 * The `default` is a resilient catch-all so a stale/unknown category string
 * (e.g. a row written before a schema change) still renders rather than vanishing.
 */
export function mapCategoryToGroup(category: BenefitCategory): OverviewCategoryGroup {
  switch (category) {
    case "dining": return "Dining";
    case "travel":
    case "lounge": return "Travel";
    case "streaming":
    case "shopping":
    case "general": return "Lifestyle";
    case "wellness": return "Wellness";
    default: return "Lifestyle"; // resilient catch-all for stale/unknown category strings
  }
}

/** Aggregates one group's credit list into a CategoryGroup row. */
function toCategoryGroup(group: OverviewCategoryGroup, credits: OverviewBenefit[]): CategoryGroup {
  const sorted = [...credits].sort((a, b) => b.unusedAmount - a.unusedAmount);
  return {
    group,
    credits: sorted,
    totalRemaining: sorted.reduce((s, c) => s + c.unusedAmount, 0),
    totalUsed: sorted.reduce((s, c) => s + c.usedAmount, 0),
    totalValue: sorted.reduce((s, c) => s + (c.value ?? 0), 0),
    creditCount: sorted.length,
    cardCount: new Set(sorted.map((c) => c.cardId)).size,
  };
}

/**
 * Groups onTrack credits into the 4 Overview display groups. Only non-empty
 * groups are returned, sorted by totalRemaining desc, tie-broken by group name
 * asc for deterministic output.
 */
export function buildActiveCreditsByCategory(credits: OverviewBenefit[]): CategoryGroup[] {
  const byGroup = new Map<OverviewCategoryGroup, OverviewBenefit[]>();
  for (const c of credits) {
    const group = mapCategoryToGroup(c.category);
    const bucket = byGroup.get(group) ?? [];
    bucket.push(c);
    byGroup.set(group, bucket);
  }
  return Array.from(byGroup.entries())
    .map(([group, list]) => toCategoryGroup(group, list))
    .sort((a, b) => b.totalRemaining - a.totalRemaining || a.group.localeCompare(b.group));
}

/**
 * The needsAttention rows still worth acting on — unredeemed value remains this
 * period. The optimistic client update (`use-overview-data.ts`) deliberately does
 * not re-bucket, so a just-completed credit stays in needsAttention until the next
 * refetch. Counting it would have the Overview claim "7 credits at risk" when one
 * of them is already done, so every count the user reads filters through here.
 * The row itself stays on screen (it shows `Done`) — only the counts change.
 */
export function stillAtRisk(rows: OverviewBenefit[]): OverviewBenefit[] {
  return rows.filter((r) => r.unusedAmount > 0);
}

/**
 * Builds the hero sparkbar from the at-risk (needsAttention) set. Each segment's
 * weight is its share of the total unredeemed value; input order is preserved
 * (needsAttention is already sorted soonest-first). Returns [] when nothing is at risk.
 */
export function buildSparkbarSegments(atRisk: OverviewBenefit[]): SparkbarSegment[] {
  const total = atRisk.reduce((s, c) => s + c.unusedAmount, 0);
  if (total <= 0) return [];
  return atRisk.map((c) => ({
    benefitId: c.benefitId,
    issuerColor: c.cardColor,
    weight: c.unusedAmount / total,
    remaining: c.unusedAmount,
  }));
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
    activeByCategory: buildActiveCreditsByCategory(onTrack),
    sparkbar: buildSparkbarSegments(needsAttention),
  };
}
