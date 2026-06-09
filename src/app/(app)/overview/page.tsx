"use client";

import Link from "next/link";
import { TopBar } from "@/components/overview/topbar";
import { MoneyAtRiskHero } from "@/components/overview/money-at-risk-hero";
import { ExpiringSection } from "@/components/overview/expiring-section";
import { CategorySection } from "@/components/overview/category-section";
import { SettledSection } from "@/components/overview/settled-section";
import { OV } from "@/components/overview/tokens";
import { useOverviewData } from "@/hooks/use-overview-data";

/** Number of skeleton rows shown during initial load. */
const SKELETON_COUNT = 3;

export default function OverviewPage() {
  const { state, reload } = useOverviewData();

  if (state.status === "loading") return <OverviewSkeleton />;
  if (state.status === "error")
    return <OverviewError onRetry={() => reload(true)} />;

  const { moneyAtRisk, needsAttention, onTrack, done, activeByCategory, sparkbar } =
    state.data;
  const isEmpty =
    needsAttention.length === 0 && onTrack.length === 0 && done.length === 0;

  if (isEmpty) return <OverviewEmpty />;

  return (
    <div
      className="relative min-h-[calc(100dvh-64px)] overflow-hidden"
      style={{ background: OV.bg, color: OV.text }}
    >
      {/* Warm halo behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -120,
          left: -60,
          right: -60,
          height: 360,
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0) 70%)",
          zIndex: 0,
        }}
      />

      <div className="relative pb-24" style={{ zIndex: 1 }}>
        <TopBar />
        <MoneyAtRiskHero
          moneyAtRisk={moneyAtRisk}
          needsAttention={needsAttention}
          sparkbar={sparkbar}
        />
        <div style={{ height: 1, background: OV.hairline, margin: "4px 0" }} />
        <ExpiringSection items={needsAttention} />
        <CategorySection groups={activeByCategory} />
        <SettledSection done={done} />
      </div>
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
