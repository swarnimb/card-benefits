"use client";

import type { BenefitWithPeriod, BenefitType } from "@/types/benefit";
import { BenefitItem } from "./benefit-item";

/** Props for the scrollable benefits list inside an expanded card. */
export interface BenefitListProps {
  benefits: BenefitWithPeriod[];
  cardColor: string;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
  /** Optional sync callback invoked after a successful tracked PATCH so the parent list re-renders. */
  onTrackedUpdate?: (benefitId: string, newTracked: boolean) => void;
  /** Optional sync callback invoked after a successful activation PATCH (set-and-forget benefits). */
  onActivated?: (benefitId: string, activatedAt: Date | null) => void;
}

const GROUP_ORDER: BenefitType[] = ["credit", "subscription", "access", "perk"];

const GROUP_LABELS: Record<BenefitType, string> = {
  credit: "$Credits",
  subscription: "Subscriptions",
  access: "Access",
  perk: "One-time Perks",
};

/**
 * Groups benefits by type (credit → subscription → access → perk) and renders
 * a section header + BenefitItem rows per group. Empty groups are omitted.
 * Set-and-forget benefits are pulled out of the per-type groups into a calm,
 * de-emphasized "Automatic" group rendered last (PRD Feature 8).
 */
export function BenefitList({ benefits, cardColor, onUsageUpdate, onTrackedUpdate, onActivated }: BenefitListProps) {
  const periodic = benefits.filter((b) => !b.setAndForget);
  const automatic = benefits.filter((b) => b.setAndForget);

  const renderItems = (items: BenefitWithPeriod[]) =>
    items.map((benefit) => (
      <BenefitItem
        key={benefit.id}
        benefit={benefit}
        cardColor={cardColor}
        onUsageUpdate={onUsageUpdate}
        onTrackedUpdate={onTrackedUpdate}
        onActivated={onActivated}
      />
    ));

  return (
    <div>
      {GROUP_ORDER.map((type) => {
        const group = periodic.filter((b) => b.type === type);
        if (group.length === 0) return null;

        return (
          <div key={type}>
            <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-[#6B7280]">
              {GROUP_LABELS[type]}
            </p>
            {renderItems(group)}
          </div>
        );
      })}

      {automatic.length > 0 && (
        <div className="mt-2 border-t border-white/10">
          <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-[#6B7280]/70">
            Automatic
          </p>
          {renderItems(automatic)}
        </div>
      )}
    </div>
  );
}
