"use client";

import { useState } from "react";
import Link from "next/link";
import { CardStack } from "@/components/cards/card-stack";
import { CardsTopBar } from "@/components/cards/cards-topbar";
import { PortfolioStats } from "@/components/cards/portfolio-stats";
import { CardDetailOverlay } from "@/components/cards/card-detail-overlay";
import { useCardsData } from "@/hooks/use-cards-data";
import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import { COLORS, TYPE } from "@/lib/ui/tokens";

export default function CardsPage() {
  const { cards, loading, error, retry, updateBenefitUsage, syncBenefitTracked, syncBenefitActivation } = useCardsData();
  const portfolio = usePortfolioStats();
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const expandedCard = cards.find((c) => c.id === expandedCardId) ?? null;

  if (loading) return <CardsSkeleton />;
  if (error) return <CardsError onRetry={retry} />;
  if (cards.length === 0) return <CardsEmpty />;

  const issuerCount = new Set(cards.map((c) => c.card.issuer)).size;

  return (
    <>
      {/* Wallet (list) view */}
      <div
        style={{
          opacity: expandedCardId ? 0.3 : 1,
          transition: "opacity 0.3s ease",
          pointerEvents: expandedCardId ? "none" : "auto",
        }}
      >
        <div style={{ paddingTop: 8 }}>
          <CardsTopBar cardCount={cards.length} issuerCount={issuerCount} />
          <PortfolioStats state={portfolio} />
          <div style={{ padding: "0 24px 8px" }}>
            <div className="uppercase" style={{ ...TYPE.label, color: COLORS.text3 }}>
              Your cards
            </div>
          </div>
        </div>
        <CardStack
          cards={cards}
          expandedId={expandedCardId}
          onExpand={setExpandedCardId}
        />
      </div>

      {/* Full-screen overlay when a card is selected */}
      <CardDetailOverlay
        expandedCard={expandedCard}
        onClose={() => setExpandedCardId(null)}
        onUsageUpdate={updateBenefitUsage}
        onTrackedUpdate={syncBenefitTracked}
        onActivated={syncBenefitActivation}
      />
    </>
  );
}

function CardsSkeleton() {
  return (
    <div
      aria-label="Loading cards"
      className="flex justify-center overflow-hidden"
      style={{ height: "calc(100dvh - 64px)", paddingTop: 32 }}
    >
      <div style={{ width: "80%" }} className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="w-full animate-pulse rounded-2xl"
            style={{ aspectRatio: "85.6 / 53.98", background: COLORS.surface }}
          />
        ))}
      </div>
    </div>
  );
}

function CardsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 px-4">
      <p className="text-center" style={{ color: COLORS.text2 }}>
        Could not load cards — tap to retry
      </p>
      <button
        onClick={onRetry}
        className="min-h-[48px] rounded-full px-6 py-3 text-sm font-medium"
        style={{ background: COLORS.surface, color: COLORS.text }}
      >
        Retry
      </button>
    </div>
  );
}

function CardsEmpty() {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-2 px-4">
      <p className="text-center" style={{ color: COLORS.text2 }}>
        No cards added yet.
      </p>
      <Link href="/admin" className="text-sm underline" style={{ color: COLORS.text }}>
        Go to Admin →
      </Link>
    </div>
  );
}
