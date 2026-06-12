"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import type { PortfolioStats } from "@/types/api";

/** Loading/ready/error state for the read-only portfolio stats fetch. */
export type PortfolioStatsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; stats: PortfolioStats };

/**
 * Fetches portfolio-wide value figures from GET /api/portfolio/stats
 * (annual fees / redeemed YTD / available). Read-only — never mutated here.
 * Returns an explicit state machine so the UI can skeleton instead of
 * flashing NaN before the data lands.
 */
export function usePortfolioStats(): PortfolioStatsState {
  const [state, setState] = useState<PortfolioStatsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/portfolio/stats")
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET /api/portfolio/stats returned ${res.status}`);
        const stats: PortfolioStats = await res.json();
        if (!cancelled) setState({ status: "ok", stats });
      })
      .catch((err: unknown) => {
        console.error("GET /api/portfolio/stats failed:", err);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
