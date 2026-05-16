"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { OV, OV_COUNT_UP } from "./tokens";

interface MoneyAtRiskHeroProps {
  totalUnredeemed: number;
  soonestDaysUntilReset: number | null;
}

/**
 * Headline "money left on the table that resets soon". Real Framer Motion
 * count-up on mount; calm variant when nothing is at risk. Reduced-motion safe.
 */
export function MoneyAtRiskHero({
  totalUnredeemed,
  soonestDaysUntilReset,
}: MoneyAtRiskHeroProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const atRisk = totalUnredeemed > 0 && soonestDaysUntilReset !== null;

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(totalUnredeemed);
      return;
    }
    const controls = animate(0, totalUnredeemed, {
      ...OV_COUNT_UP,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [totalUnredeemed, reduceMotion]);

  return (
    <section className="relative px-5 pt-6 pb-6" style={{ background: OV.bg }}>
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

      <p className="max-w-[280px] text-sm" style={{ lineHeight: 1.45, color: OV.text2 }}>
        {atRisk ? (
          <>
            Resets in{" "}
            <span style={{ color: OV.amber, fontWeight: 500 }}>
              {soonestDaysUntilReset} {soonestDaysUntilReset === 1 ? "day" : "days"}
            </span>
            . <span style={{ color: OV.text3 }}>Use it before it&apos;s gone.</span>
          </>
        ) : (
          <span style={{ color: OV.text3 }}>
            Nothing at risk — you&apos;re on top of it.
          </span>
        )}
      </p>
    </section>
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
