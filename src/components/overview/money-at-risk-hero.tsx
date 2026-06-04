"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type {
  OverviewBenefit,
  OverviewMoneyAtRisk,
  SparkbarSegment,
} from "@/types/api";
import type { Issuer } from "@/types/card";
import { OV, OV_COUNT_UP, OV_OVERSHOOT } from "./tokens";
import { usd, humanizeIssuer } from "./format";

interface MoneyAtRiskHeroProps {
  moneyAtRisk: OverviewMoneyAtRisk;
  needsAttention: OverviewBenefit[];
  sparkbar: SparkbarSegment[];
}

/**
 * Headline "money left on the table that resets soon" (CONSTRAINT-18: never a
 * realized/redeemed figure). 56px tabular count-up, amber pulse eyebrow,
 * proportional sparkbar, and a top-issuer / actions footnote. Calm variant when
 * nothing is at risk — no sparkbar, no footnote, never Math.min on []. Warm
 * radial halo is rendered by the page behind this section.
 */
export function MoneyAtRiskHero({
  moneyAtRisk,
  needsAttention,
  sparkbar,
}: MoneyAtRiskHeroProps) {
  const reduceMotion = useReducedMotion();
  const total = moneyAtRisk.totalUnredeemed;
  const atRisk = needsAttention.length > 0;

  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (reduceMotion) {
      setDisplay(total);
      return;
    }
    const controls = animate(0, total, {
      ...OV_COUNT_UP,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [total, reduceMotion]);

  return (
    <section className="relative px-5 pt-[22px] pb-6" style={{ background: OV.bg }}>
      <div className="mb-3.5 flex items-center gap-2">
        <PulseDot active={atRisk} reduceMotion={!!reduceMotion} />
        <span
          className="text-[11px] font-medium uppercase"
          style={{ letterSpacing: "1.1px", color: OV.text3 }}
        >
          Money at risk
        </span>
      </div>

      <div
        className="mb-3 font-semibold leading-none tabular-nums"
        style={{ fontSize: 56, letterSpacing: "-2.2px", color: OV.text }}
      >
        ${Math.round(display).toLocaleString("en-US")}
      </div>

      {atRisk ? (
        <>
          <p
            className="mb-[18px] max-w-[280px] text-sm"
            style={{ lineHeight: 1.45, letterSpacing: "-0.1px", color: OV.text2 }}
          >
            Resets in{" "}
            <span style={{ color: OV.amber, fontWeight: 500 }}>
              {moneyAtRisk.soonestDaysUntilReset} days
            </span>
            .{" "}
            <span style={{ color: OV.text3 }}>
              {needsAttention.length} credits across {countCards(needsAttention)} cards.
            </span>
          </p>

          <Sparkbar segments={sparkbar} reduceMotion={!!reduceMotion} />

          <div
            className="mt-2.5 flex justify-between text-[10.5px] tabular-nums"
            style={{ letterSpacing: "0.3px", color: OV.text3 }}
          >
            <span>{topIssuerLabel(needsAttention)}</span>
            <span>{needsAttention.length} actions needed</span>
          </div>
        </>
      ) : (
        <p
          className="max-w-[280px] text-sm"
          style={{ lineHeight: 1.45, color: OV.text3 }}
        >
          Nothing at risk — you&apos;re on top of it.
        </p>
      )}
    </section>
  );
}

/** Distinct source-card count across the at-risk set. */
function countCards(items: OverviewBenefit[]): number {
  return new Set(items.map((c) => c.cardId)).size;
}

/**
 * Top issuer by summed at-risk dollars (replaces the mock's hardcoded "Amex").
 * Sums unusedAmount per issuer display-name, returns "$X {Issuer}".
 */
function topIssuerLabel(items: OverviewBenefit[]): string {
  const byIssuer = new Map<Issuer, number>();
  for (const c of items) {
    byIssuer.set(c.issuer, (byIssuer.get(c.issuer) ?? 0) + c.unusedAmount);
  }
  let topIssuer: Issuer = items[0]?.issuer ?? "Other";
  let topSum = -Infinity;
  for (const [issuer, sum] of byIssuer) {
    if (sum > topSum) {
      topSum = sum;
      topIssuer = issuer;
    }
  }
  return `${usd(topSum)} ${humanizeIssuer(topIssuer)}`;
}

/** Proportional hero sparkbar. Each segment grows with a staggered scaleX. */
function Sparkbar({
  segments,
  reduceMotion,
}: {
  segments: SparkbarSegment[];
  reduceMotion: boolean;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-full"
      style={{ gap: 2, height: 5 }}
    >
      {segments.map((s, i) => (
        <motion.div
          key={s.benefitId}
          className="min-w-0"
          style={{ flex: s.weight, background: s.issuerColor, transformOrigin: "left" }}
          title={`${usd(s.remaining)}`}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.7, ease: OV_OVERSHOOT, delay: 0.05 + i * 0.04 }
          }
        />
      ))}
    </div>
  );
}

function PulseDot({
  active,
  reduceMotion,
}: {
  active: boolean;
  reduceMotion: boolean;
}) {
  const color = active ? OV.amber : OV.green;
  return (
    <span className="relative inline-block" style={{ width: 8, height: 8 }}>
      {active && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 2.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}88` }}
      />
    </span>
  );
}
