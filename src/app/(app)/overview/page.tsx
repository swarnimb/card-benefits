"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MoneyAtRiskHero } from "@/components/overview/money-at-risk-hero";
import { UrgencySection } from "@/components/overview/urgency-section";
import { OV } from "@/components/overview/tokens";
import type { OverviewData } from "@/types/api";

/** Number of skeleton rows shown during initial load. */
const SKELETON_COUNT = 3;

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: OverviewData };

export default function OverviewPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });

  /**
   * Fetches overview data. Pass showSkeleton=true for initial load.
   * Visibility-change refetches run silently — existing data stays visible.
   */
  const loadOverview = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setState({ status: "loading" });
    try {
      const res = await fetch("/api/overview");
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data: OverviewData = await res.json();
      setState({ status: "ok", data });
    } catch {
      setState((prev) =>
        prev.status === "loading" ? { status: "error" } : prev
      );
    }
  }, []);

  useEffect(() => {
    loadOverview(true);
  }, [loadOverview]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") loadOverview();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadOverview]);

  if (state.status === "loading") return <OverviewSkeleton />;
  if (state.status === "error")
    return <OverviewError onRetry={() => loadOverview(true)} />;

  const { moneyAtRisk, needsAttention, onTrack, done } = state.data;
  const isEmpty =
    needsAttention.length === 0 && onTrack.length === 0 && done.length === 0;

  if (isEmpty) return <OverviewEmpty />;

  return (
    <div
      className="min-h-[calc(100dvh-64px)]"
      style={{ background: OV.bg, color: OV.text }}
    >
      <MoneyAtRiskHero
        totalUnredeemed={moneyAtRisk.totalUnredeemed}
        soonestDaysUntilReset={moneyAtRisk.soonestDaysUntilReset}
      />
      <div style={{ height: 1, background: OV.hairline }} />
      <UrgencySection
        title="Needs attention"
        tone="attention"
        benefits={needsAttention}
      />
      <UrgencySection title="On track" tone="track" benefits={onTrack} />
      <UrgencySection
        title="Done"
        tone="settled"
        benefits={done}
        defaultCollapsed
      />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div
      className="min-h-[calc(100dvh-64px)] space-y-3 px-4 py-6"
      style={{ background: OV.bg }}
      aria-label="Loading overview"
    >
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl"
          style={{ background: OV.surface }}
        />
      ))}
    </div>
  );
}

function OverviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 px-4"
      style={{ background: OV.bg }}
    >
      <p className="text-center" style={{ color: OV.text2 }}>
        Could not load overview — tap to retry
      </p>
      <button
        onClick={onRetry}
        className="min-h-[48px] rounded-full px-6 py-3 text-sm font-medium"
        style={{ background: OV.surface, color: OV.text }}
      >
        Retry
      </button>
    </div>
  );
}

function OverviewEmpty() {
  return (
    <div
      className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-2 px-6 text-center"
      style={{ background: OV.bg }}
    >
      <p style={{ color: OV.text }} className="text-base font-medium">
        No tracked benefits yet
      </p>
      <p style={{ color: OV.text2 }} className="max-w-[280px] text-sm">
        Add a card and scrape its benefits to start tracking what resets and
        when.{" "}
        <Link href="/admin" style={{ color: OV.amber }} className="underline">
          Add a card in Admin →
        </Link>
      </p>
    </div>
  );
}
