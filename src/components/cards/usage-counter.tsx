"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Props for the +/- counter control (access-type benefits). */
export interface UsageCounterProps {
  benefitId: string;
  count: number;
  max: number | null;
  onUpdate: (value: number) => void;
}

/** Duration matches animation spec: 120ms slot-machine roll */
const ROLL_DURATION = 0.12;

/**
 * Access benefit counter — +/- buttons with slot-machine number roll animation.
 */
export function UsageCounter({
  benefitId,
  count,
  max,
  onUpdate,
}: UsageCounterProps) {
  const reducedMotion = useReducedMotion();

  function handleDecrement(): void {
    if (count <= 0) return;
    onUpdate(count - 1);
  }

  function handleIncrement(): void {
    if (max !== null && count >= max) return;
    onUpdate(count + 1);
  }

  const isDecrementDisabled = count <= 0;
  const isIncrementDisabled = max !== null && count >= max;
  const visitLabel = max !== null ? `${count} / ${max} visits` : `${count} visits`;

  return (
    <div
      data-testid={`usage-counter-${benefitId}`}
      className="flex items-center gap-4"
    >
      <button
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
        aria-label="Decrease count"
        className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full bg-[#252321] text-[#F9F9F8] text-xl font-medium disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
      >
        −
      </button>

      <div className="flex flex-col items-center min-w-[80px]">
        <div
          className="relative overflow-hidden h-8 flex items-center justify-center"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={count}
              initial={reducedMotion ? {} : { y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? {} : { y: -20, opacity: 0 }}
              transition={{ duration: ROLL_DURATION }}
              className="text-2xl font-semibold text-[#F9F9F8] tabular-nums"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className="text-xs text-[#9CA3AF] mt-1">{visitLabel}</span>
      </div>

      <button
        onClick={handleIncrement}
        disabled={isIncrementDisabled}
        aria-label="Increase count"
        className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full bg-[#252321] text-[#F9F9F8] text-xl font-medium disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
      >
        +
      </button>
    </div>
  );
}
