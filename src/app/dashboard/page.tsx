"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { CardCarousel } from "@/components/dashboard/card-carousel";
import { CardView } from "@/components/dashboard/card-view";
import { BenefitList } from "@/components/dashboard/benefit-list";
import { PointsDisplay } from "@/components/dashboard/points-display";
import { BenefitModal } from "@/components/dashboard/benefit-modal";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  UserCardWithCard,
  CardBenefitsResponse,
  BenefitWithUtilization,
} from "@/types/card";

export default function DashboardPage() {
  const [userCards, setUserCards] = useState<UserCardWithCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [benefitsData, setBenefitsData] = useState<CardBenefitsResponse | null>(
    null
  );
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [benefitsError, setBenefitsError] = useState<string | null>(null);

  const [selectedBenefit, setSelectedBenefit] =
    useState<BenefitWithUtilization | null>(null);

  // Fetch user cards on mount
  useEffect(() => {
    fetch("/api/cards/user")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cards: ${res.status}`);
        return res.json();
      })
      .then((data: UserCardWithCard[]) => {
        setUserCards(data);
        setCardsLoading(false);
      })
      .catch((err) => {
        setCardsError(err.message);
        setCardsLoading(false);
      });
  }, []);

  // Fetch benefits when active card changes
  const activeCard = userCards[activeIndex];

  const fetchBenefits = useCallback(async () => {
    if (!activeCard) return;

    setBenefitsLoading(true);
    setBenefitsError(null);
    try {
      const res = await fetch(`/api/benefits/${activeCard.id}`);
      if (!res.ok) throw new Error(`Failed to load benefits: ${res.status}`);
      const data: CardBenefitsResponse = await res.json();
      setBenefitsData(data);
    } catch (err) {
      console.error("Benefits fetch failed:", err);
      setBenefitsError(err instanceof Error ? err.message : "Failed to load benefits");
      setBenefitsData(null);
    } finally {
      setBenefitsLoading(false);
    }
  }, [activeCard]);

  useEffect(() => {
    fetchBenefits();
  }, [fetchBenefits]);

  // Loading state
  if (cardsLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (cardsError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6">
        <p className="text-sm font-medium text-destructive">{cardsError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-muted-foreground underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // No cards — prompt to add
  if (userCards.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <EmptyState variant="card-added" />
      </div>
    );
  }

  const hasTransactions =
    benefitsData?.benefits.some(
      (b) => b.utilization && b.utilization.amountUsed > 0
    ) ?? false;

  return (
    <div className="flex min-h-dvh flex-col gap-6 pt-6 pb-6">
      {/* Card carousel */}
      <CardCarousel
        userCards={userCards}
        activeIndex={activeIndex}
        onCardChange={setActiveIndex}
      />

      {/* Active card detail */}
      {activeCard && (
        <CardView userCard={activeCard} loading={benefitsLoading}>
          {benefitsError ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm font-medium text-destructive">
                {benefitsError}
              </p>
              <button
                type="button"
                onClick={fetchBenefits}
                className="text-sm text-muted-foreground underline"
              >
                Retry
              </button>
            </div>
          ) : benefitsData ? (
            <>
              {/* Points */}
              <PointsDisplay
                userCardId={activeCard.id}
                points={benefitsData.points}
                onBalanceUpdated={fetchBenefits}
              />

              {/* Benefits */}
              <BenefitList
                benefits={benefitsData.benefits}
                onBenefitTap={setSelectedBenefit}
              />

              {/* Import hint when no transactions tracked yet */}
              {!hasTransactions && <EmptyState variant="no-csv" />}
            </>
          ) : null}
        </CardView>
      )}
      {/* Benefit detail modal */}
      <BenefitModal
        benefit={selectedBenefit}
        onClose={() => setSelectedBenefit(null)}
      />
    </div>
  );
}
