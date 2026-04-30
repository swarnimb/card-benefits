"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { UserCardWithCard } from "@/types/card";
import type { BenefitWithPeriod } from "@/types/benefit";

/** Props for the expanded card overlay. */
export interface CardExpandedProps {
  userCard: UserCardWithCard;
  benefits: BenefitWithPeriod[];
  onCollapse: () => void;
}

const EXPAND_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const LIST_SPRING = { type: "spring", stiffness: 300, damping: 35 } as const;

/**
 * Expanded card view — full-height overlay with scrollable benefits list.
 * Shares layoutId with CardItem for shared layout animation on expand/collapse.
 * Wrap the mount/unmount with AnimatePresence in the parent to enable exit animation.
 */
export function CardExpanded({
  userCard,
  benefits,
  onCollapse,
}: CardExpandedProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      layoutId={userCard.id}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: userCard.card.defaultColor }}
      animate={
        prefersReducedMotion
          ? undefined
          : { scale: 1.02, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }
      }
      exit={
        prefersReducedMotion
          ? undefined
          : { scale: 1.0, boxShadow: "0 0px 0px rgba(0,0,0,0)" }
      }
      transition={EXPAND_SPRING}
    >
      {/* Card header — tap to collapse */}
      <button
        className="p-4 text-left w-full"
        onClick={onCollapse}
        aria-label={`Collapse ${userCard.card.name}`}
      >
        <p className="text-xl font-bold text-white">{userCard.card.issuer}</p>
        <p className="text-base font-medium text-white/80 mt-0.5">{userCard.card.name}</p>
      </button>

      {/* Benefits list — slides up on expand, replaced by <BenefitList> in Task 22 */}
      <motion.div
        className="overflow-y-auto bg-[#1A1917] rounded-b-2xl flex-1"
        initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={LIST_SPRING}
      >
        {benefits.map((benefit) => (
          <div
            key={benefit.id}
            className="px-4 py-3 border-b border-white/10 last:border-0"
          >
            <p className="text-sm font-medium text-[#F9F9F8]">{benefit.name}</p>
            {benefit.description && (
              <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{benefit.description}</p>
            )}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
