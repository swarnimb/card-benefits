"use client";

import Link from "next/link";
import {
  FileUp,
  Coins,
  CalendarX,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyVariant = "no-csv" | "no-points" | "no-transactions" | "card-added";

interface VariantConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

const variants: Record<EmptyVariant, VariantConfig> = {
  "no-csv": {
    icon: FileUp,
    title: "No transactions yet",
    description: "Import a CSV from your bank to start tracking benefit usage.",
    cta: { label: "Import CSV", href: "/import" },
  },
  "no-points": {
    icon: Coins,
    title: "Points not set",
    description:
      "Add your current points balance to see your estimated total grow.",
  },
  "no-transactions": {
    icon: CalendarX,
    title: "Nothing this period",
    description:
      "No matching transactions found for the current billing period.",
  },
  "card-added": {
    icon: CreditCard,
    title: "Card added!",
    description:
      "Your benefits are ready to view. Import transactions to start tracking utilization.",
    cta: { label: "Import CSV", href: "/import" },
  },
};

interface EmptyStateProps {
  variant: EmptyVariant;
  className?: string;
}

export function EmptyState({ variant, className }: EmptyStateProps) {
  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-8",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium">{config.title}</p>
        <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
          {config.description}
        </p>
      </div>

      {config.cta && (
        <Button asChild size="sm" variant="outline" className="mt-1">
          <Link href={config.cta.href}>{config.cta.label}</Link>
        </Button>
      )}
    </div>
  );
}
