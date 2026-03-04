"use client";

import { ExternalLink, Calendar, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UtilizationBar } from "@/components/dashboard/utilization-bar";
import type { BenefitWithUtilization } from "@/types/card";

interface BenefitModalProps {
  benefit: BenefitWithUtilization | null;
  onClose: () => void;
}

function formatPeriodLabel(capPeriod: string | null): string {
  switch (capPeriod) {
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annual":
      return "Annual";
    default:
      return "Ongoing";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRate(benefit: BenefitWithUtilization): string | null {
  if (benefit.rate == null || benefit.rateType == null) return null;
  if (benefit.rateType === "multiplier") return `${benefit.rate}X points`;
  if (benefit.rateType === "percentage")
    return `${(benefit.rate * 100).toFixed(0)}% back`;
  return null;
}

export function BenefitModal({ benefit, onClose }: BenefitModalProps) {
  if (!benefit) return null;

  const isTrackable = benefit.trackingType === "trackable";
  const rate = formatRate(benefit);

  return (
    <Dialog open={!!benefit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{benefit.name}</DialogTitle>
          <DialogDescription>{benefit.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Rate + type badges */}
          <div className="flex flex-wrap gap-2">
            {rate && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                <TrendingUp className="h-3 w-3" />
                {rate}
              </span>
            )}
            {benefit.category && (
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {benefit.category}
              </span>
            )}
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {benefit.type.replace("_", " ")}
            </span>
          </div>

          {/* Utilization section — trackable benefits only */}
          {isTrackable && benefit.utilization && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {formatPeriodLabel(benefit.capPeriod)} &middot;{" "}
                  {formatDate(benefit.utilization.periodStart)} &ndash;{" "}
                  {formatDate(benefit.utilization.periodEnd)}
                </span>
              </div>

              <UtilizationBar
                amountUsed={benefit.utilization.amountUsed}
                capAmount={benefit.utilization.capAmount}
                percentage={benefit.utilization.percentage}
              />
            </div>
          )}

          {/* External link */}
          {benefit.externalUrl && (
            <a
              href={benefit.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View benefit details
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
