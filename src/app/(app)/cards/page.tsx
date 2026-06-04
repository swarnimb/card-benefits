"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CardStack } from "@/components/cards/card-stack";
import { CardItem } from "@/components/cards/card-item";
import { BenefitList } from "@/components/cards/benefit-list";
import { CardsTopBar } from "@/components/cards/cards-topbar";
import { PortfolioStats } from "@/components/cards/portfolio-stats";
import { CardDetailStats } from "@/components/cards/card-detail-stats";
import { useCardsData } from "@/hooks/use-cards-data";
import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import { COLORS, TYPE } from "@/lib/ui/tokens";
import { humanizeIssuer } from "@/components/overview/format";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 35 };

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
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{ background: "rgba(15,14,13,0.9)" }}
              onClick={() => setExpandedCardId(null)}
            />

            {/* Scrollable content */}
            <motion.div
              className="relative z-10 flex-1 overflow-y-auto hide-scrollbar pb-20"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={SPRING}
            >
              <div className="mx-auto" style={{ width: "80%" }}>
                {/* Detail header: back + issuer eyebrow + card name */}
                <div className="flex items-center gap-3" style={{ padding: "16px 0 14px" }}>
                  <button
                    onClick={() => setExpandedCardId(null)}
                    aria-label="Back"
                    className="flex items-center justify-center transition-colors hover:bg-white/[0.07]"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 99,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${COLORS.hairline}`,
                      color: COLORS.text2,
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, letterSpacing: 0.3, color: COLORS.text3 }}>
                      {humanizeIssuer(expandedCard.card.issuer)}
                    </div>
                    <div
                      className="truncate"
                      style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3, color: COLORS.text }}
                    >
                      {expandedCard.card.name}
                    </div>
                  </div>
                </div>

                {/* Hero card (animation untouched) */}
                <CardItem
                  userCard={expandedCard}
                  benefits={expandedCard.benefits}
                  isExpanded={true}
                  onTap={() => setExpandedCardId(null)}
                />

                {/* Per-card realized stats */}
                <div style={{ paddingTop: 18, paddingBottom: 4 }}>
                  <CardDetailStats
                    annualFee={expandedCard.card.annualFee ?? null}
                    benefits={expandedCard.benefits}
                  />
                </div>

                {/* Benefits panel */}
                {expandedCard.benefits.length > 0 ? (
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...SPRING, delay: 0.1 }}
                    className="mt-3 rounded-2xl"
                    style={{ background: COLORS.surface }}
                  >
                    <BenefitList
                      benefits={expandedCard.benefits}
                      cardColor={expandedCard.card.defaultColor}
                      onUsageUpdate={(benefitId, newAmount) =>
                        updateBenefitUsage(expandedCard.id, benefitId, newAmount)
                      }
                      onTrackedUpdate={(benefitId, newTracked) =>
                        syncBenefitTracked(expandedCard.id, benefitId, newTracked)
                      }
                      onActivated={(benefitId, activatedAt) =>
                        syncBenefitActivation(expandedCard.id, benefitId, activatedAt)
                      }
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...SPRING, delay: 0.1 }}
                    className="mt-3 rounded-2xl"
                    style={{ background: COLORS.surface }}
                  >
                    <p className="px-4 py-6 text-center text-sm" style={{ color: COLORS.text3 }}>
                      No benefits yet — scrape or add manually in Admin
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
