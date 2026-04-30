"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Props for the binary used/unused toggle (subscription-type benefits). */
export interface UsageToggleProps {
  benefitId: string;
  isActivated: boolean;
  cardColor: string;
  onUpdate: (value: number) => void;
}

/** Spring snap spec from design-decisions.md */
const SNAP_SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };

/**
 * Subscription benefit toggle — snap animation, fills with cardColor when activated.
 */
export function UsageToggle({
  benefitId,
  isActivated,
  cardColor,
  onUpdate,
}: UsageToggleProps) {
  const reducedMotion = useReducedMotion();

  function handleClick(): void {
    onUpdate(isActivated ? 0 : 1);
  }

  return (
    <motion.button
      data-testid={`usage-toggle-${benefitId}`}
      onClick={handleClick}
      aria-pressed={isActivated}
      aria-label={`Toggle benefit: ${isActivated ? "Claimed" : "Not claimed"}`}
      animate={{ backgroundColor: isActivated ? cardColor : "#374151" }}
      transition={reducedMotion ? { duration: 0 } : SNAP_SPRING}
      className="flex items-center gap-2 rounded-full px-4 min-h-[48px] min-w-[128px] justify-center focus:outline-none"
    >
      <span className="text-sm font-medium text-[#F9F9F8]">
        {isActivated ? "Claimed" : "Not claimed"}
      </span>
      {isActivated && (
        <span className="text-sm text-[#F9F9F8]" aria-hidden="true">✓</span>
      )}
    </motion.button>
  );
}
