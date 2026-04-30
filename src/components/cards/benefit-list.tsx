"use client";

import type { BenefitWithPeriod, BenefitType } from "@/types/benefit";
import { BenefitItem } from "./benefit-item";

/** Props for the scrollable benefits list inside an expanded card. */
export interface BenefitListProps {
  benefits: BenefitWithPeriod[];
  cardColor: string;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
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
 */
export function BenefitList({ benefits, cardColor, onUsageUpdate }: BenefitListProps) {
  return (
    <div>
      {GROUP_ORDER.map((type) => {
        const group = benefits.filter((b) => b.type === type);
        if (group.length === 0) return null;

        return (
          <div key={type}>
            <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-[#6B7280]">
              {GROUP_LABELS[type]}
            </p>
            {group.map((benefit) => (
              <BenefitItem
                key={benefit.id}
                benefit={benefit}
                cardColor={cardColor}
                onUsageUpdate={onUsageUpdate}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
