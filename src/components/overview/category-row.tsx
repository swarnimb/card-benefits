"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { OverviewData } from "@/types/api";

const BG_SURFACE = "#1A1917";
const COLOR_COMPLETE = "#4ADE80";
const COLOR_BAR_BG = "#374151";
const COLOR_BAR_DEFAULT = "#9CA3AF";
const TEXT_PRIMARY = "#F9F9F8";
const TEXT_CAPTION = "#6B7280";
const TEXT_SECONDARY = "#9CA3AF";

const EXPAND_SPRING = { type: "spring" as const, stiffness: 400, damping: 35 };

type Category = OverviewData["categories"][0];

interface CategoryRowProps {
  category: Category;
}

/** An expandable row showing usage progress for a credit category with per-card breakdown. */
export function CategoryRow({ category }: CategoryRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const { category: name, totalValue, totalUsed, cards } = category;
  const isFullyUsed = totalUsed >= totalValue;
  const progressPercent = totalValue > 0 ? Math.min((totalUsed / totalValue) * 100, 100) : 0;

  return (
    <div
      className="rounded-lg p-4 mb-3 cursor-pointer select-none"
      style={{ backgroundColor: BG_SURFACE }}
      onClick={() => setIsExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setIsExpanded((prev) => !prev);
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: TEXT_CAPTION }}>
        {name}
      </p>
      <p className="text-3xl font-semibold tracking-tight mb-3" style={{ color: TEXT_PRIMARY }}>
        ${Math.round(totalUsed)} / ${Math.round(totalValue)}
      </p>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLOR_BAR_BG }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: isFullyUsed ? COLOR_COMPLETE : COLOR_BAR_DEFAULT,
          }}
        />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="breakdown"
            initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? {} : { height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? {} : EXPAND_SPRING}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {cards.map((card) => {
                const cardPercent = card.totalValue > 0 ? Math.min((card.totalUsed / card.totalValue) * 100, 100) : 0;
                return (
                  <div key={card.cardName}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs" style={{ color: TEXT_SECONDARY }}>
                        {card.cardName}
                      </span>
                      <span className="text-xs" style={{ color: TEXT_SECONDARY }}>
                        ${Math.round(card.totalUsed)} / ${Math.round(card.totalValue)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: COLOR_BAR_BG }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${cardPercent}%`, backgroundColor: card.cardColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
