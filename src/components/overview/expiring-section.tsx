"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OverviewBenefit } from "@/types/api";
import { OV } from "./tokens";
import { usd, humanizeIssuer } from "./format";
import { IssuerDot } from "./issuer-dot";
import { Progress } from "./progress";
import { SectionHeader } from "./section-header";

interface ExpiringSectionProps {
  /** needsAttention[] — already sorted soonest-first by the engine. */
  items: OverviewBenefit[];
}

/**
 * "Expiring soon" — the at-risk credits. Renders nothing when empty (the page
 * also guards this). Ports the design source `ExpiringSection` / `ExpiringRow`.
 */
export function ExpiringSection({ items }: ExpiringSectionProps) {
  if (items.length === 0) return null;
  return (
    <section className="px-4 pt-2 pb-1.5">
      <SectionHeader
        label="Expiring soon"
        right={<span style={{ color: OV.amber }}>{items.length}</span>}
      />
      <div className="flex flex-col gap-2.5">
        {items.map((c, i) => (
          <ExpiringRow key={c.benefitId} c={c} i={i} />
        ))}
      </div>
    </section>
  );
}

function ExpiringRow({ c, i }: { c: OverviewBenefit; i: number }) {
  const reduceMotion = useReducedMotion();
  const remaining = c.unusedAmount;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: OV.surface,
        border: `1px solid ${OV.hairline}`,
        padding: "14px 16px 16px",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.04 * i }}
    >
      {/* Issuer color rail */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{ left: 0, top: 14, bottom: 14, width: 2.5, background: c.cardColor, opacity: 0.85 }}
      />

      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="mb-1 truncate text-[14.5px] font-medium"
            style={{ color: OV.text, letterSpacing: "-0.15px" }}
          >
            {c.benefitName}
          </div>
          <div
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: OV.text3, letterSpacing: "0.1px" }}
          >
            <IssuerDot color={c.cardColor} size={5} />
            <span className="truncate">
              {humanizeIssuer(c.issuer)} {c.cardName}
            </span>
            <span style={{ color: OV.text4 }}>·</span>
            <span>{c.resetPeriod}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-lg font-semibold leading-none tabular-nums"
            style={{ color: OV.text, letterSpacing: "-0.5px" }}
          >
            {usd(remaining)}
          </div>
          {c.daysUntilReset !== null && (
            <div
              className="mt-1 text-[10.5px] font-medium"
              style={{ color: OV.amber, letterSpacing: "0.2px" }}
            >
              {c.daysUntilReset}d left
            </div>
          )}
        </div>
      </div>

      <Progress
        used={c.usedAmount}
        amt={c.value}
        color={OV.amber}
        track="rgba(245,158,11,0.10)"
        height={2.5}
      />

      <div
        className="mt-2 flex justify-between text-[10.5px] tabular-nums"
        style={{ color: OV.text3 }}
      >
        <span>{usd(c.usedAmount)} used</span>
        <span style={{ color: OV.text4 }}>
          {c.value === null ? "unlimited" : `of ${usd(c.value)}`}
        </span>
      </div>
    </motion.div>
  );
}
