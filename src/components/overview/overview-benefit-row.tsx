"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OverviewBenefit } from "@/types/api";
import { OV, OV_URGENT_DAYS } from "./tokens";

interface OverviewBenefitRowProps {
  benefit: OverviewBenefit;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/**
 * One benefit row for the Overview triage sections. Type, category and the
 * source card are row-level metadata only — never a top-level grouping
 * (binding constraint #3 / PRD F6). Long names truncate with an ellipsis.
 */
export function OverviewBenefitRow({ benefit }: OverviewBenefitRowProps) {
  const reduceMotion = useReducedMotion();
  const {
    benefitName,
    cardName,
    issuer,
    cardColor,
    type,
    category,
    unusedAmount,
    daysUntilReset,
  } = benefit;
  const urgent = daysUntilReset !== null && daysUntilReset <= OV_URGENT_DAYS;

  return (
    <motion.div
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: OV.surface,
        border: `1px solid ${OV.hairline}`,
        padding: "14px 16px 16px",
      }}
    >
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{ left: 0, top: 14, bottom: 14, width: 2.5, background: cardColor, opacity: 0.85 }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[14.5px] font-medium"
            style={{ color: OV.text, letterSpacing: "-0.15px" }}
          >
            {benefitName}
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 truncate text-[11px]"
            style={{ color: OV.text3 }}
          >
            <span>{issuer}</span>
            <span style={{ color: OV.text4 }}>·</span>
            <span className="truncate">{cardName}</span>
            <span style={{ color: OV.text4 }}>·</span>
            <span className="capitalize">{type}</span>
            <span style={{ color: OV.text4 }}>·</span>
            <span className="capitalize">{category}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="text-lg font-semibold leading-none tabular-nums"
            style={{ color: OV.text, letterSpacing: "-0.5px" }}
          >
            {usd(unusedAmount)}
          </div>
          {daysUntilReset !== null && (
            <div
              className="mt-1 text-[10.5px] font-medium"
              style={{ color: urgent ? OV.amber : OV.text3 }}
            >
              {daysUntilReset}d left
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
