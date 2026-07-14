"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { OverviewBenefit } from "@/types/api";
import { OV, OV_SPRING } from "./tokens";
import { usd, humanizeIssuer } from "./format";
import { IssuerDot } from "./issuer-dot";
import { Progress } from "./progress";

interface ExpiringSectionProps {
  /** needsAttention[] — already sorted soonest-first by the engine. */
  items: OverviewBenefit[];
}

/**
 * "Expiring soon" — the at-risk credits, collapsed by default (the money-at-risk
 * hero above already carries the headline). The header stays "hot" (amber wash)
 * so the urgency reads even while collapsed, and echoes the count + total at
 * risk — the same figure the hero shows, since both sum needsAttention's
 * unusedAmount (see `buildOverviewTriage`). Renders nothing when empty (the page
 * also guards this). Rows port the design source `ExpiringRow`.
 */
export function ExpiringSection({ items }: ExpiringSectionProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const totalAtRisk = items.reduce((sum, c) => sum + c.unusedAmount, 0);

  return (
    <section className="px-4 pt-2 pb-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] text-left"
        style={{
          background: OV.amberSoft,
          border: `1px solid ${OV.amberBorder}`,
          padding: "12px 14px",
          font: "inherit",
        }}
      >
        <WarningTriangle />
        <div className="flex flex-1 items-center gap-2">
          <span
            className="text-[11px] font-medium uppercase"
            style={{ letterSpacing: "1.1px", color: OV.amber }}
          >
            Expiring soon
          </span>
          <span className="text-[11px]" style={{ color: OV.text3 }}>
            · {items.length} · {usd(totalAtRisk)} at risk
          </span>
        </div>
        <motion.span
          aria-hidden
          className="inline-flex"
          style={{ color: OV.amber }}
          animate={reduceMotion ? undefined : { rotate: open ? 180 : 0 }}
          transition={OV_SPRING}
        >
          <Chevron />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="expiring-body"
            className="overflow-hidden"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : OV_SPRING}
          >
            <div className="flex flex-col gap-2.5" style={{ paddingTop: 10 }}>
              {items.map((c, i) => (
                <ExpiringRow key={c.benefitId} c={c} i={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Amber warning triangle — keeps the collapsed header reading as urgent. */
function WarningTriangle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M12 3 L22 20 H2 Z"
        stroke={OV.amber}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line x1="12" y1="10" x2="12" y2="14" stroke={OV.amber} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.95" fill={OV.amber} />
    </svg>
  );
}

/** Down-chevron; the wrapping motion.span rotates it 180° when expanded. */
function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
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
        track={OV.amberTrack}
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
