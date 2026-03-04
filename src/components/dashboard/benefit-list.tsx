"use client";

import { useMemo } from "react";
import { BenefitItem } from "@/components/dashboard/benefit-item";
import type { BenefitWithUtilization } from "@/types/card";

interface BenefitListProps {
  benefits: BenefitWithUtilization[];
  onBenefitTap?: (benefit: BenefitWithUtilization) => void;
}

export function BenefitList({ benefits, onBenefitTap }: BenefitListProps) {
  const { tracked, available } = useMemo(() => {
    const tracked: BenefitWithUtilization[] = [];
    const available: BenefitWithUtilization[] = [];

    for (const b of benefits) {
      if (b.trackingType === "trackable") {
        tracked.push(b);
      } else {
        available.push(b);
      }
    }

    return { tracked, available };
  }, [benefits]);

  if (benefits.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No benefits found for this card.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tracked benefits — with utilization bars */}
      {tracked.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tracked
          </h3>
          <div className="flex flex-col gap-2">
            {tracked.map((b) => (
              <BenefitItem
                key={b.id}
                benefit={b}
                onTap={() => onBenefitTap?.(b)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available benefits — display-only with descriptions */}
      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available
          </h3>
          <div className="flex flex-col gap-2">
            {available.map((b) => (
              <BenefitItem
                key={b.id}
                benefit={b}
                onTap={() => onBenefitTap?.(b)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
