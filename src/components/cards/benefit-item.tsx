"use client";

import type { BenefitWithPeriod } from "@/types/benefit";
import { UsageSlider } from "./usage-slider";
import { UsageToggle } from "./usage-toggle";
import { UsageCounter } from "./usage-counter";

/** Props for a single benefit row with its usage control. */
export interface BenefitItemProps {
  benefit: BenefitWithPeriod;
  cardColor: string;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
}

const EXPIRING_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const COLOR_COMPLETE = "#4ADE80";

/** Formats a numeric value with the appropriate unit prefix/suffix. */
function formatValue(amount: number, unit: string): string {
  if (unit === "points") return `${amount.toLocaleString()} pts`;
  return `$${amount.toLocaleString()}`;
}

function isExpiringSoon(benefit: BenefitWithPeriod): boolean {
  const end = benefit.currentPeriod?.periodEnd;
  if (!end) return false;
  const daysLeft = (new Date(end).getTime() - Date.now()) / MS_PER_DAY;
  return daysLeft >= 0 && daysLeft <= EXPIRING_DAYS;
}

function daysUntilReset(benefit: BenefitWithPeriod): number | null {
  const end = benefit.currentPeriod?.periodEnd;
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / MS_PER_DAY);
}

/**
 * Single benefit row — name, description, expiring label, and inline tracking UI.
 */
export function BenefitItem({ benefit, cardColor, onUsageUpdate }: BenefitItemProps) {
  const expiring = isExpiringSoon(benefit);
  const daysLeft = expiring ? daysUntilReset(benefit) : null;
  const usedAmount = benefit.currentPeriod?.usedAmount ?? 0;
  const isComplete = benefit.value !== null && usedAmount >= benefit.value;
  const sliderColor = isComplete ? COLOR_COMPLETE : cardColor;

  return (
    <div className="px-4 py-3 border-b border-white/10 last:border-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#F9F9F8]">{benefit.name}</p>
        {benefit.value !== null && (
          <span className="text-sm font-medium text-[#F9F9F8]">
            {formatValue(benefit.value, benefit.valueUnit)}
          </span>
        )}
      </div>
      {benefit.description && (
        <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{benefit.description}</p>
      )}
      {expiring && daysLeft !== null && (
        <p className="text-xs text-[#F59E0B] mt-1">
          ⚠ Resets in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
        </p>
      )}

      <div className="mt-2">
        {(benefit.type === "credit" || benefit.type === "perk") && (
          <UsageSlider
            benefitId={benefit.id}
            value={usedAmount}
            max={benefit.value}
            cardColor={sliderColor}
            onUpdate={(v) => onUsageUpdate(benefit.id, v)}
          />
        )}
        {benefit.type === "subscription" && (
          <UsageToggle
            benefitId={benefit.id}
            isActivated={usedAmount > 0}
            cardColor={cardColor}
            onUpdate={(v) => onUsageUpdate(benefit.id, v)}
          />
        )}
        {benefit.type === "access" && (
          <UsageCounter
            benefitId={benefit.id}
            count={usedAmount}
            max={benefit.value}
            onUpdate={(v) => onUsageUpdate(benefit.id, v)}
          />
        )}
      </div>
    </div>
  );
}
