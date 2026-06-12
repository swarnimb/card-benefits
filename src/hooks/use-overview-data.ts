"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import type { OverviewBenefit, OverviewData } from "@/types/api";
import {
  buildActiveCreditsByCategory,
  buildSparkbarSegments,
  unusedFromParts,
} from "@/lib/engine/expiring";

/** Thrown when the initial overview fetch fails. */
class OverviewLoadError extends Error {
  constructor(cause: string) {
    super(`Failed to load overview: ${cause}`);
    this.name = "OverviewLoadError";
  }
}

/** Thrown when an optimistic usage update fails to persist. */
export class OverviewUsageUpdateError extends Error {
  constructor(benefitId: string) {
    super(`Failed to update usage for benefit ${benefitId}`);
    this.name = "OverviewUsageUpdateError";
  }
}

/** Discriminated load state for the Overview screen. */
export type OverviewLoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: OverviewData };

/** Recomputes a single benefit row's used/unused amounts (mirrors the engine's unusedValue). */
function rowWithUsage(row: OverviewBenefit, newAmount: number): OverviewBenefit {
  return {
    ...row,
    usedAmount: newAmount,
    unusedAmount: unusedFromParts(row.type, row.value, newAmount),
  };
}

/**
 * Pure optimistic recompute: updates the benefit wherever it appears across the
 * urgency buckets, then re-derives money-at-risk, the category groups, and the
 * sparkbar via the SAME engine functions the server uses — so the optimistic
 * result matches a subsequent server refetch (minus re-bucketing between
 * needs-attention / on-track / done, which the visibility refetch reconciles).
 */
function recomputeOverview(
  data: OverviewData,
  benefitId: string,
  newAmount: number,
): OverviewData {
  const apply = (rows: OverviewBenefit[]) =>
    rows.map((r) => (r.benefitId === benefitId ? rowWithUsage(r, newAmount) : r));
  const needsAttention = apply(data.needsAttention);
  const onTrack = apply(data.onTrack);
  const done = apply(data.done);
  const totalUnredeemed = needsAttention.reduce((s, r) => s + r.unusedAmount, 0);

  return {
    needsAttention,
    onTrack,
    done,
    moneyAtRisk: { ...data.moneyAtRisk, totalUnredeemed },
    activeByCategory: buildActiveCreditsByCategory(onTrack),
    sparkbar: buildSparkbarSegments(needsAttention),
  };
}

/** Return shape for useOverviewData. */
export interface OverviewDataResult {
  state: OverviewLoadState;
  /** Refetch the overview. Pass true to show the skeleton (initial load / retry). */
  reload: (showSkeleton?: boolean) => void;
  /**
   * Optimistically log usage for a benefit and persist via
   * POST /api/benefits/[id]/usage — the only usage write path (CONSTRAINT-07).
   * Recomputes the hero + category totals immediately; reverts and throws on failure.
   */
  updateBenefitUsage: (benefitId: string, newAmount: number) => Promise<void>;
}

/**
 * Owns the Overview screen's data lifecycle: initial load, silent
 * visibility-change refetch, retry, and optimistic usage logging.
 */
export function useOverviewData(): OverviewDataResult {
  const [state, setState] = useState<OverviewLoadState>({ status: "loading" });

  const reload = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setState({ status: "loading" });
    try {
      const res = await apiFetch("/api/overview");
      if (!res.ok)
        throw new OverviewLoadError(`GET /api/overview returned ${res.status}`);
      const data: OverviewData = await res.json();
      setState({ status: "ok", data });
    } catch {
      // Keep showing stale data on a silent refetch; only the initial load surfaces error.
      setState((prev) => (prev.status === "loading" ? { status: "error" } : prev));
    }
  }, []);

  useEffect(() => {
    reload(true);
  }, [reload]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [reload]);

  const updateBenefitUsage = useCallback(
    async (benefitId: string, newAmount: number): Promise<void> => {
      if (state.status !== "ok") return;
      const prevData = state.data;
      setState({
        status: "ok",
        data: recomputeOverview(prevData, benefitId, newAmount),
      });

      const res = await apiFetch(`/api/benefits/${benefitId}/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usedAmount: newAmount }),
      });

      if (!res.ok) {
        setState({ status: "ok", data: prevData });
        throw new OverviewUsageUpdateError(benefitId);
      }
    },
    [state],
  );

  return { state, reload, updateBenefitUsage };
}
