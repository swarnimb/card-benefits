"use client";

import {
  Utensils,
  Plane,
  ShoppingCart,
  Fuel,
  Tv,
  Ticket,
  Pill,
  Bus,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UtilizationBar } from "@/components/dashboard/utilization-bar";
import type { BenefitWithUtilization } from "@/types/card";

const categoryIcons: Record<string, LucideIcon> = {
  dining: Utensils,
  travel: Plane,
  groceries: ShoppingCart,
  gas: Fuel,
  streaming: Tv,
  entertainment: Ticket,
  drugstore: Pill,
  transit: Bus,
  general: Star,
};

function formatRate(benefit: BenefitWithUtilization): string | null {
  if (benefit.rate == null || benefit.rateType == null) return null;
  if (benefit.rateType === "multiplier") return `${benefit.rate}X`;
  if (benefit.rateType === "percentage") return `${(benefit.rate * 100).toFixed(0)}%`;
  return null;
}

interface BenefitItemProps {
  benefit: BenefitWithUtilization;
  onTap?: () => void;
}

export function BenefitItem({ benefit, onTap }: BenefitItemProps) {
  const Icon = categoryIcons[benefit.category ?? "general"] ?? Star;
  const isTrackable = benefit.trackingType === "trackable";
  const rate = formatRate(benefit);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`View details for ${benefit.name}`}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3",
        "text-left transition-all duration-200",
        "hover:border-muted-foreground/30 active:scale-[0.98]"
      )}
    >
      {/* Category icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium leading-tight">
            {benefit.name}
          </p>
          {rate && (
            <span className="flex-shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {rate}
            </span>
          )}
        </div>

        {isTrackable && benefit.utilization ? (
          <div className="mt-2">
            <UtilizationBar
              amountUsed={benefit.utilization.amountUsed}
              capAmount={benefit.utilization.capAmount}
              percentage={benefit.utilization.percentage}
            />
          </div>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {benefit.description}
          </p>
        )}
      </div>
    </button>
  );
}
