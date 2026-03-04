"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UserCardItem = {
  id: string;
  card: {
    bankName: string;
    cardName: string;
    imageColor: string;
  };
};

interface PointsEntryProps {
  userCards: UserCardItem[];
  values: Map<string, string>;
  onChange: (userCardId: string, value: string) => void;
}

export function PointsEntry({ userCards, values, onChange }: PointsEntryProps) {
  return (
    <div className="flex flex-col gap-3">
      {userCards.map((uc) => {
        const rawValue = values.get(uc.id) ?? "";

        return (
          <div
            key={uc.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            {/* Card color swatch */}
            <div
              className="flex h-10 w-14 items-center justify-center rounded-lg"
              style={{ backgroundColor: uc.card.imageColor }}
            >
              <CreditCard
                className="h-5 w-5 text-white/80"
                strokeWidth={1.5}
              />
            </div>

            {/* Card name + input */}
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium leading-tight">
                {uc.card.bankName} {uc.card.cardName}
              </p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 50,000"
                value={rawValue}
                onChange={(e) => {
                  // Allow only digits and commas
                  const cleaned = e.target.value.replace(/[^0-9,]/g, "");
                  onChange(uc.id, cleaned);
                }}
                className="h-8 text-sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
