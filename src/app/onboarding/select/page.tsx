"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPicker } from "@/components/onboarding/card-picker";
import { cn } from "@/lib/utils";

type CardItem = {
  id: string;
  bankName: string;
  cardName: string;
  annualFee: number;
  imageColor: string;
};

export default function SelectCardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cards: ${res.status}`);
        return res.json();
      })
      .then((data: CardItem[]) => {
        setCards(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleToggle = useCallback((cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  const handleContinue = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/cards/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Save failed: ${res.status}`);
      }

      router.push("/onboarding/points");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }, [selectedIds, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Pick Your Cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the credit cards you carry.{" "}
          <span className="font-medium text-foreground">
            {cards.length} cards
          </span>{" "}
          available.
        </p>
      </div>

      {/* Card picker */}
      <div className="flex-1 overflow-y-auto px-6">
        <CardPicker
          cards={cards}
          selectedIds={selectedIds}
          onToggle={handleToggle}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="px-6 text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Bottom action */}
      <div className="sticky bottom-0 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-lg">
        <Button
          onClick={handleContinue}
          disabled={selectedIds.size === 0 || saving}
          size="lg"
          className={cn(
            "w-full text-base font-semibold",
            "transition-all duration-200 active:scale-95"
          )}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {selectedIds.size === 0
            ? "Select at least 1 card"
            : `Continue with ${selectedIds.size} card${selectedIds.size > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
