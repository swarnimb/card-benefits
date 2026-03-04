"use client";

import { cn } from "@/lib/utils";
import type { UserCardWithCard } from "@/types/card";

interface CardViewProps {
  userCard: UserCardWithCard;
  loading?: boolean;
  children: React.ReactNode;
}

export function CardView({ userCard, loading, children }: CardViewProps) {
  const { card } = userCard;

  return (
    <section className="flex flex-col gap-5 px-6">
      {/* Card header — contextual anchor for content below */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-3 w-3 flex-shrink-0 rounded-full shadow-sm",
              "ring-2 ring-offset-2 ring-offset-background"
            )}
            style={{
              backgroundColor: card.imageColor,
              // ring color matches card to tie visual to carousel
              ["--tw-ring-color" as string]: card.imageColor,
            }}
          />
          <div>
            <h2 className="text-base font-semibold leading-tight">
              {card.cardName}
            </h2>
            <p className="text-xs text-muted-foreground">
              {card.bankName} &middot; ${card.annualFee}/yr
            </p>
          </div>
        </div>
      </div>

      {/* Content area: points + benefits (supplied by parent) */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">{children}</div>
      )}
    </section>
  );
}
