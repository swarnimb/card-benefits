"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ExpiringAlerts } from "@/components/overview/expiring-alerts";
import { CategoryList } from "@/components/overview/category-list";
import type { OverviewData } from "@/types/api";

const BG_SURFACE = "#1A1917";
const TEXT_SECONDARY = "#9CA3AF";
const TEXT_PRIMARY = "#F9F9F8";

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
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadOverview]);

  if (state.status === "loading") return <OverviewSkeleton />;
  if (state.status === "error") return <OverviewError onRetry={() => loadOverview(true)} />;

  const { categories, expiringSoon } = state.data;
  const hasContent = categories.some((c) => c.totalValue > 0);

  return (
    <div className="min-h-[calc(100dvh-64px)] px-4 py-6">
      <ExpiringAlerts alerts={expiringSoon} />
      {hasContent ? <CategoryList categories={categories} /> : <OverviewEmpty />}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="px-4 py-6 space-y-3" aria-label="Loading overview">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={i}
          className="h-24 rounded-lg animate-pulse"
          style={{ backgroundColor: BG_SURFACE }}
        />
      ))}
    </div>
  );
}

function OverviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 px-4">
      <p className="text-center" style={{ color: TEXT_SECONDARY }}>
        Could not load overview — tap to retry
      </p>
      <button
        onClick={onRetry}
        className="min-h-[48px] rounded-full px-6 py-3 text-sm font-medium"
        style={{ backgroundColor: BG_SURFACE, color: TEXT_PRIMARY }}
      >
        Retry
      </button>
    </div>
  );
}

function OverviewEmpty() {
  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-2 px-4">
      <p className="text-center" style={{ color: TEXT_SECONDARY }}>
        No credit benefits tracked yet.{" "}
        <Link href="/admin" style={{ color: TEXT_PRIMARY }} className="underline">
          Add a card in Admin →
        </Link>
      </p>
    </div>
  );
}
