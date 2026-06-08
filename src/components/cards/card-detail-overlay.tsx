"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CardItem } from "@/components/cards/card-item";
import { BenefitList } from "@/components/cards/benefit-list";
import { CardDetailStats } from "@/components/cards/card-detail-stats";
import { COLORS } from "@/lib/ui/tokens";
import { humanizeIssuer } from "@/components/overview/format";
import type { UserCardWithBenefits } from "@/types/card";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 35 };

export interface CardDetailOverlayProps {
  /** The selected card, or null when the overlay is closed. */
  expandedCard: UserCardWithBenefits | null;
  onClose: () => void;
  onUsageUpdate: (userCardId: string, benefitId: string, newAmount: number) => void;
  onTrackedUpdate: (userCardId: string, benefitId: string, newTracked: boolean) => void;
  onActivated: (userCardId: string, benefitId: string, activatedAt: Date | null) => void;
}

/**
 * Full-screen card-detail overlay. Extracted verbatim from `cards/page.tsx`
 * (CQ file-size split): the Apple-Wallet stack expand/collapse animation —
 * `AnimatePresence`, the slide-up `{ y: 80 → 0, opacity }`, `SPRING`
 * (stiffness 400 / damping 35), and `CardItem`'s shared-layout `layoutId` — is
 * preserved exactly. Only moved, not altered.
 */
export function CardDetailOverlay({
  expandedCard,
  onClose,
  onUsageUpdate,
  onTrackedUpdate,
  onActivated,
}: CardDetailOverlayProps) {
  return (
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
            style={{ background: COLORS.scrim }}
            onClick={onClose}
          />

          {/* Scrollable content */}
          <motion.div
            className="relative z-10 flex-1 overflow-y-auto hide-scrollbar pb-20"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={SPRING}
          >
            {/* CONSTRAINT-23: overlay root is `fixed inset-0` so it escapes the
                app-shell's centered column; recreate it here to match the
                420px column of Overview/Cards/Admin. px-6 (24px) matches the
                Cards screen's horizontal content inset. */}
            <div className="mx-auto w-full max-w-[420px] px-6">
              {/* Detail header: back + issuer eyebrow + card name */}
              <div className="flex items-center gap-3" style={{ padding: "16px 0 14px" }}>
                <button
                  onClick={onClose}
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
                onTap={onClose}
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
                      onUsageUpdate(expandedCard.id, benefitId, newAmount)
                    }
                    onTrackedUpdate={(benefitId, newTracked) =>
                      onTrackedUpdate(expandedCard.id, benefitId, newTracked)
                    }
                    onActivated={(benefitId, activatedAt) =>
                      onActivated(expandedCard.id, benefitId, activatedAt)
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
  );
}
