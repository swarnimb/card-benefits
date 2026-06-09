"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { OverviewBenefit } from "@/types/api";
import { OV, OV_SPRING, OV_URGENT_DAYS } from "./tokens";
import { usd, humanizeIssuer } from "./format";
import { IssuerDot } from "./issuer-dot";
import { Chevron } from "./chevron";
import { UsageSlider } from "@/components/cards/usage-slider";
import { UsageToggle } from "@/components/cards/usage-toggle";
import { UsageCounter } from "@/components/cards/usage-counter";

interface CategoryDetailRowProps {
  c: OverviewBenefit;
  last: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
}

/**
 * Single credit row inside an expanded category card. Tap reveals an inline
 * usage control (Task 71). Set-and-forget benefits are info-only here — their
 * activation lives in the Cards space and they hold no period (CONSTRAINT-17),
 * so logging usage against them is intentionally not offered.
 */
export function CategoryDetailRow({
  c,
  last,
  expanded,
  onToggle,
  onUsageUpdate,
}: CategoryDetailRowProps) {
  const reduceMotion = useReducedMotion();
  const remaining = c.unusedAmount;
  const fullyUsed = remaining === 0 && c.value !== null;
  const urgent = c.daysUntilReset !== null && c.daysUntilReset <= OV_URGENT_DAYS;
  const loggable = !c.setAndForget;

  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${OV.hairline}` }}>
      <button
        type="button"
        onClick={loggable ? onToggle : undefined}
        aria-expanded={loggable ? expanded : undefined}
        disabled={!loggable}
        className="flex w-full items-center gap-2.5 text-left"
        style={{
          padding: "10px 0",
          background: "transparent",
          border: 0,
          color: "inherit",
          font: "inherit",
          cursor: loggable ? "pointer" : "default",
        }}
      >
        <IssuerDot color={c.cardColor} size={6} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px]"
            style={{ color: OV.text, letterSpacing: "-0.1px" }}
          >
            {c.benefitName}
          </div>
          <div className="mt-0.5 text-[10.5px]" style={{ color: OV.text3 }}>
            {humanizeIssuer(c.issuer)} · {c.resetPeriod}
            {urgent && (
              <span style={{ color: OV.amber, marginLeft: 6 }}>· {c.daysUntilReset}d</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-[13.5px] font-medium tabular-nums"
            style={{ color: fullyUsed ? OV.green : OV.text }}
          >
            {fullyUsed ? "Done" : c.value === null ? "—" : usd(remaining)}
          </div>
          <div className="mt-0.5 text-[10px] tabular-nums" style={{ color: OV.text4 }}>
            {usd(c.usedAmount)} / {c.value === null ? "∞" : usd(c.value)}
          </div>
        </div>
        {loggable && (
          <motion.span
            aria-hidden
            className="ml-1 inline-flex shrink-0"
            style={{ color: OV.text4 }}
            animate={reduceMotion ? undefined : { rotate: expanded ? 180 : 0 }}
            transition={OV_SPRING}
          >
            <Chevron size={10} />
          </motion.span>
        )}
      </button>

      {loggable && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="control"
              className="overflow-hidden"
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={reduceMotion ? {} : { height: "auto", opacity: 1 }}
              exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : OV_SPRING}
            >
              <div style={{ padding: "4px 0 14px" }}>
                <UsageControl c={c} onUpdate={(n) => onUsageUpdate(c.benefitId, n)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/** Dispatches the matching usage control by benefit type — reused from the Cards space. */
function UsageControl({
  c,
  onUpdate,
}: {
  c: OverviewBenefit;
  onUpdate: (newAmount: number) => void;
}) {
  const isComplete = c.value !== null && c.usedAmount >= c.value;

  if (c.type === "credit" || c.type === "perk") {
    return (
      <UsageSlider
        benefitId={c.benefitId}
        value={c.usedAmount}
        max={c.value}
        cardColor={isComplete ? OV.green : c.cardColor}
        onUpdate={onUpdate}
      />
    );
  }
  if (c.type === "subscription") {
    return (
      <UsageToggle
        benefitId={c.benefitId}
        isActivated={c.usedAmount > 0}
        cardColor={c.cardColor}
        onUpdate={onUpdate}
      />
    );
  }
  return (
    <UsageCounter
      benefitId={c.benefitId}
      count={c.usedAmount}
      max={c.value}
      onUpdate={onUpdate}
    />
  );
}
