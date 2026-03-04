"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface UtilizationBarProps {
  amountUsed: number;
  capAmount: number | null;
  percentage: number | null;
}

export function UtilizationBar({
  amountUsed,
  capAmount,
  percentage,
}: UtilizationBarProps) {
  // Animate fill from 0 on mount
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Uncapped benefit — show amount only, no bar
  if (capAmount === null || percentage === null) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          ${amountUsed.toFixed(0)}
        </span>{" "}
        used &middot; no cap
      </p>
    );
  }

  const clamped = Math.min(percentage, 100);

  // Color coding: green → yellow → red
  const barColor =
    clamped >= 85
      ? "bg-red-500"
      : clamped >= 60
        ? "bg-amber-500"
        : "bg-emerald-500";

  const trackColor =
    clamped >= 85
      ? "bg-red-500/15"
      : clamped >= 60
        ? "bg-amber-500/15"
        : "bg-emerald-500/15";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Bar */}
      <div className={cn("relative h-2 w-full overflow-hidden rounded-full", trackColor)}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            barColor
          )}
          style={{ width: animated ? `${clamped}%` : "0%" }}
        />
      </div>

      {/* Label */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            ${amountUsed.toFixed(0)}
          </span>{" "}
          / ${capAmount.toFixed(0)}
        </p>
        <p className={cn(
          "text-xs font-medium",
          clamped >= 85 ? "text-red-500" : "text-muted-foreground"
        )}>
          {Math.round(clamped)}%
        </p>
      </div>
    </div>
  );
}
