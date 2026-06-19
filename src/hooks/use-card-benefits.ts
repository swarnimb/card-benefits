"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import type { BenefitWithPeriod } from "@/types/benefit";

/** Result of the lazy per-card benefits hook (Task 83). */
export interface CardBenefitsResult {
  benefits: BenefitWithPeriod[];
  loading: boolean;
  error: string | null;
  /** Force a re-fetch (used after add/edit/delete mutations refresh the list). */
  refetch: () => void;
}

/**
 * LAZILY fetches a card's benefits — only once `enabled` flips true (i.e. on the
 * first row expand). Collapsed rows never fetch. Re-fetching (after an inline
 * add/edit/delete) goes through `refetch`. Errors are surfaced (never swallowed)
 * so the row can show a visible amber alert instead of an empty list (EH-01).
 */
export function useCardBenefits(userCardId: string, enabled: boolean): CardBenefitsResult {
  const [benefits, setBenefits] = useState<BenefitWithPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped to trigger a re-fetch; starts at 0 so the first enable also fetches.
  const [tick, setTick] = useState(0);
  // Tracks whether we have ever fetched, so a collapsed→expand cycle does not
  // refetch needlessly while still allowing an explicit refetch().
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (fetched && tick === 0) return;

    let cancelled = false;

    // Run the load in an async closure so no setState fires synchronously in the
    // effect body (avoids cascading-render churn; mirrors the data-fetch idiom).
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/user-cards/${userCardId}/benefits`);
        if (!res.ok) throw new Error(`GET benefits returned ${res.status}`);
        const data = (await res.json()) as BenefitWithPeriod[];
        if (cancelled) return;
        setBenefits(data);
        setFetched(true);
      } catch (err) {
        if (cancelled) return;
        console.error(`load benefits failed (userCardId=${userCardId})`, err);
        setError("Could not load benefits");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [userCardId, enabled, tick, fetched]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  return { benefits, loading, error, refetch };
}
