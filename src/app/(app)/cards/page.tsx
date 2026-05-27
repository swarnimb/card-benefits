"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CardStack } from "@/components/cards/card-stack";
import { CardItem } from "@/components/cards/card-item";
import { BenefitList } from "@/components/cards/benefit-list";
import { useCardsData } from "@/hooks/use-cards-data";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 35 };

export default function CardsPage() {
  const { cards, loading, error, retry, updateBenefitUsage, syncBenefitTracked } = useCardsData();
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const expandedCard = cards.find((c) => c.id === expandedCardId) ?? null;

  if (loading) return <CardsSkeleton />;
  if (error) return <CardsError onRetry={retry} />;
  if (cards.length === 0) return <CardsEmpty />;

  return (
    <>
      <CardStack
        cards={cards}
        expandedId={expandedCardId}
        onExpand={setExpandedCardId}
      />

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
              className="absolute inset-0 bg-[#0F0E0D]/90"
              onClick={() => setExpandedCardId(null)}
            />

            {/* Scrollable content */}
            <motion.div
              className="relative z-10 overflow-y-auto hide-scrollbar flex-1 pb-20"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={SPRING}
            >
              {/* Close button */}
              <div className="flex justify-end px-[10%] pt-4 pb-2">
                <button
                  onClick={() => setExpandedCardId(null)}
                  className="p-2 rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Card */}
              <div className="mx-auto" style={{ width: "80%" }}>
                <CardItem
                  userCard={expandedCard}
                  benefits={expandedCard.benefits}
                  isExpanded={true}
                  onTap={() => setExpandedCardId(null)}
                />

                {/* Benefits panel */}
                {expandedCard.benefits.length > 0 ? (
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...SPRING, delay: 0.1 }}
                    className="rounded-2xl bg-[#1A1917] mt-3"
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
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...SPRING, delay: 0.1 }}
                    className="rounded-2xl bg-[#1A1917] mt-3"
                  >
                    <p className="px-4 py-6 text-sm text-[#6B7280] text-center">
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
            className="w-full animate-pulse rounded-2xl bg-[#1A1917]"
            style={{ aspectRatio: "85.6 / 53.98" }}
          />
        ))}
      </div>
    </div>
  );
}

function CardsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 px-4">
      <p className="text-center text-[#9CA3AF]">
        Could not load cards — tap to retry
      </p>
      <button
        onClick={onRetry}
        className="min-h-[48px] rounded-full bg-[#1A1917] px-6 py-3 text-sm font-medium text-[#F9F9F8]"
      >
        Retry
      </button>
    </div>
  );
}

function CardsEmpty() {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-2 px-4">
      <p className="text-center text-[#9CA3AF]">No cards added yet.</p>
      <Link href="/admin" className="text-sm text-[#F9F9F8] underline">
        Go to Admin →
      </Link>
    </div>
  );
}
