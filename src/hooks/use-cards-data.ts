"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import type { UserCardWithBenefits } from "@/types/card";
import type { BenefitWithPeriod } from "@/types/benefit";

class CardsLoadError extends Error {
  constructor(cause: string) {
    super(`Failed to load cards: ${cause}`);
    this.name = "CardsLoadError";
  }
}

class UsageUpdateError extends Error {
  constructor(benefitId: string) {
    super(`Failed to update usage for benefit ${benefitId}`);
    this.name = "UsageUpdateError";
  }
}


function applyOptimisticUsageUpdate(
  cards: UserCardWithBenefits[],
  cardId: string,
  benefitId: string,
  newAmount: number
): UserCardWithBenefits[] {
  return cards.map((card) =>
    card.id !== cardId
      ? card
      : {
          ...card,
          benefits: card.benefits.map((benefit) =>
            benefit.id !== benefitId || !benefit.currentPeriod
              ? benefit
              : {
                  ...benefit,
                  currentPeriod: {
                    ...benefit.currentPeriod,
                    usedAmount: newAmount,
                  },
                }
          ),
        }
  );
}

function applyOptimisticTrackedUpdate(
  cards: UserCardWithBenefits[],
  cardId: string,
  benefitId: string,
  newTracked: boolean
): UserCardWithBenefits[] {
  return cards.map((card) =>
    card.id !== cardId
      ? card
      : {
          ...card,
          benefits: card.benefits.map((benefit) =>
            benefit.id !== benefitId
              ? benefit
              : { ...benefit, tracked: newTracked }
          ),
        }
  );
}

function applyOptimisticActivationUpdate(
  cards: UserCardWithBenefits[],
  cardId: string,
  benefitId: string,
  activatedAt: Date | null
): UserCardWithBenefits[] {
  return cards.map((card) =>
    card.id !== cardId
      ? card
      : {
          ...card,
          benefits: card.benefits.map((benefit) =>
            benefit.id !== benefitId
              ? benefit
              : { ...benefit, activatedAt }
          ),
        }
  );
}

async function fetchCardsWithBenefits(): Promise<UserCardWithBenefits[]> {
  const res = await apiFetch("/api/user-cards");
  if (!res.ok) throw new CardsLoadError(`GET /api/user-cards returned ${res.status}`);

  const userCards: UserCardWithBenefits[] = await res.json();

  return Promise.all(
    userCards.map(async (card) => {
      const benefitsRes = await apiFetch(`/api/user-cards/${card.id}/benefits`);
      const benefits: BenefitWithPeriod[] = benefitsRes.ok
        ? await benefitsRes.json()
        : [];
      return { ...card, benefits };
    })
  );
}

/** Return type for the useCardsData hook — cards data, loading state, and mutation helpers. */
export interface CardsDataResult {
  cards: UserCardWithBenefits[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  updateBenefitUsage: (
    cardId: string,
    benefitId: string,
    newAmount: number
  ) => Promise<void>;
  /**
   * Sync local state after a successful tracked PATCH (BenefitItem owns the
   * network call + optimistic local toggle; this just updates the cards list
   * so subsequent renders show the correct value).
   */
  syncBenefitTracked: (
    cardId: string,
    benefitId: string,
    newTracked: boolean
  ) => void;
  /**
   * Sync local state after a successful activation PATCH (ActivationToggle owns
   * the network call + optimistic local flip; this updates the cards list so
   * subsequent renders show the correct activatedAt).
   */
  syncBenefitActivation: (
    cardId: string,
    benefitId: string,
    activatedAt: Date | null
  ) => void;
}

/**
 * Fetches all user cards with their current benefits.
 * Provides optimistic usage updates with automatic revert on failure.
 */
export function useCardsData(): CardsDataResult {
  const [cards, setCards] = useState<UserCardWithBenefits[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  // Loading starts true (initial state) for the first fetch; `retry` resets it
  // for subsequent fetches, so the effect body holds no synchronous setState.
  useEffect(() => {
    let cancelled = false;

    fetchCardsWithBenefits()
      .then((result) => {
        if (!cancelled) {
          setCards(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load cards";
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchTick]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setFetchTick((n) => n + 1);
  }, []);

  const updateBenefitUsage = useCallback(
    async (cardId: string, benefitId: string, newAmount: number): Promise<void> => {
      const prevCards = cards;
      setCards(applyOptimisticUsageUpdate(cards, cardId, benefitId, newAmount));

      const res = await apiFetch(`/api/benefits/${benefitId}/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usedAmount: newAmount }),
      });

      if (!res.ok) {
        setCards(prevCards);
        throw new UsageUpdateError(benefitId);
      }
    },
    [cards]
  );

  const syncBenefitTracked = useCallback(
    (cardId: string, benefitId: string, newTracked: boolean): void => {
      setCards((prev) => applyOptimisticTrackedUpdate(prev, cardId, benefitId, newTracked));
    },
    []
  );

  const syncBenefitActivation = useCallback(
    (cardId: string, benefitId: string, activatedAt: Date | null): void => {
      setCards((prev) => applyOptimisticActivationUpdate(prev, cardId, benefitId, activatedAt));
    },
    []
  );

  return { cards, loading, error, retry, updateBenefitUsage, syncBenefitTracked, syncBenefitActivation };
}
