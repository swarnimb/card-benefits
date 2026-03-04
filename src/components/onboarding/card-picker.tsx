"use client";

import { useState, useMemo } from "react";
import { Search, Check, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CardItem = {
  id: string;
  bankName: string;
  cardName: string;
  annualFee: number;
  imageColor: string;
};

interface CardPickerProps {
  cards: CardItem[];
  selectedIds: Set<string>;
  onToggle: (cardId: string) => void;
}

export function CardPicker({ cards, selectedIds, onToggle }: CardPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return cards;
    const q = search.toLowerCase();
    return cards.filter(
      (c) =>
        c.bankName.toLowerCase().includes(q) ||
        c.cardName.toLowerCase().includes(q)
    );
  }, [cards, search]);

  // Group by bank
  const grouped = useMemo(() => {
    const map = new Map<string, CardItem[]>();
    for (const card of filtered) {
      const existing = map.get(card.bankName) ?? [];
      existing.push(card);
      map.set(card.bankName, existing);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search cards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Card list grouped by bank */}
      {grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No cards match your search
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([bank, bankCards]) => (
            <div key={bank}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {bank}
              </h3>
              <div className="flex flex-col gap-2">
                {bankCards.map((card) => {
                  const isSelected = selectedIds.has(card.id);
                  return (
                    <button
                      key={card.id}
                      onClick={() => onToggle(card.id)}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border p-3",
                        "transition-all duration-200 active:scale-[0.98]",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Card color swatch */}
                      <div
                        className="flex h-10 w-14 items-center justify-center rounded-lg"
                        style={{ backgroundColor: card.imageColor }}
                      >
                        <CreditCard className="h-5 w-5 text-white/80" strokeWidth={1.5} />
                      </div>

                      {/* Card info */}
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium leading-tight">
                          {card.cardName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${card.annualFee}/yr
                        </p>
                      </div>

                      {/* Selection indicator */}
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full",
                          "transition-all duration-200",
                          isSelected
                            ? "bg-primary text-primary-foreground scale-100"
                            : "border-2 border-muted-foreground/30 scale-90"
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
