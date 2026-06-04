"use client";

import { motion, useReducedMotion } from "framer-motion";
import { COLORS, RADII, SPRING, TYPE } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import type { PortfolioStatsState } from "@/hooks/use-portfolio-stats";

/**
 * The wallet portfolio trio: Annual fees / Redeemed YTD / Available.
 * Reads from the read-only /api/portfolio/stats fetch state. While loading it
 * renders calm skeleton tiles (never a NaN flash); on error it falls back to
 * em-dashes so the layout stays stable.
 */
export function PortfolioStats({ state }: { state: PortfolioStatsState }) {
  const reduceMotion = useReducedMotion();

  const tiles: { label: string; value: string; tone: string }[] =
    state.status === "ok"
      ? [
          { label: "Annual fees", value: usd(state.stats.annualFeeTotal), tone: COLORS.text },
          { label: "Redeemed YTD", value: usd(state.stats.redeemedYtd), tone: COLORS.green },
          { label: "Available", value: usd(state.stats.available), tone: COLORS.amber },
        ]
      : [
          { label: "Annual fees", value: "—", tone: COLORS.text },
          { label: "Redeemed YTD", value: "—", tone: COLORS.green },
          { label: "Available", value: "—", tone: COLORS.amber },
        ];

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "0 20px 16px" }}
    >
      {tiles.map((s, i) => (
        <motion.div
          key={s.label}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { ...SPRING, delay: 0.04 * i }}
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            borderRadius: RADII.card - 4,
            padding: "12px 12px 14px",
          }}
        >
          <div
            className="uppercase"
            style={{
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: 0.9,
              color: COLORS.text3,
              marginBottom: 8,
            }}
          >
            {s.label}
          </div>
          {state.status === "loading" ? (
            <div
              className="animate-pulse rounded"
              style={{ height: 17, width: "70%", background: COLORS.surface2 }}
              aria-hidden="true"
            />
          ) : (
            <div
              style={{
                ...TYPE.stat,
                fontSize: 17,
                letterSpacing: -0.4,
                color: s.tone,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.value}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
