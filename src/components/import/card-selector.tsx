"use client";

import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserCardWithCard } from "@/types/card";

interface CardSelectorProps {
  userCards: UserCardWithCard[];
  selectedId: string | null;
  onSelect: (userCardId: string) => void;
  disabled?: boolean;
}

export function CardSelector({
  userCards,
  selectedId,
  onSelect,
  disabled,
}: CardSelectorProps) {
  if (userCards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cards added yet. Add cards in Settings first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Import to card
      </label>
      <div className="flex flex-col gap-2">
        {userCards.map((uc) => {
          const isSelected = uc.id === selectedId;
          return (
            <button
              key={uc.id}
              type="button"
              onClick={() => onSelect(uc.id)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                "transition-all duration-200 active:scale-[0.98]",
                "disabled:pointer-events-none disabled:opacity-50",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/30"
              )}
            >
              <div
                className="flex h-8 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: uc.card.imageColor }}
              >
                <CreditCard
                  className="h-4 w-4 text-white/80"
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium leading-tight">
                  {uc.card.cardName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uc.card.bankName}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
