"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import { isDemoMode } from "@/lib/demo/demo-mode";
import type { BenefitWithPeriod } from "@/types/benefit";

/** The allowlisted patch shape for an inline benefit edit (mirrors the PATCH route). */
export type BenefitPatch = Partial<
  Pick<
    BenefitWithPeriod,
    | "name"
    | "description"
    | "type"
    | "value"
    | "valueUnit"
    | "resetPeriod"
    | "resetAnchor"
    | "category"
    | "tracked"
  >
>;

/** Edit + delete helpers for a single benefit (Task 85). */
export interface BenefitMutations {
  editBenefit: (id: string, patch: BenefitPatch) => Promise<void>;
  deleteBenefit: (id: string) => Promise<void>;
}

/**
 * PATCH/DELETE helpers for inline benefit management. On success each calls
 * `onChanged` to refresh the card's inline list (so the new value / removal
 * shows immediately). On failure each throws a loud, contextual error (EH-01) —
 * the caller surfaces it inline and the list is left untouched.
 */
export function useBenefitMutations(onChanged: () => void): BenefitMutations {
  const editBenefit = useCallback(
    async (id: string, patch: BenefitPatch): Promise<void> => {
      const res = await apiFetch(`/api/benefits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error(`PATCH /api/benefits/${id} failed (status=${res.status})`);
        throw new Error(`Edit failed (${res.status})`);
      }
      onChanged();
    },
    [onChanged],
  );

  const deleteBenefit = useCallback(
    async (id: string): Promise<void> => {
      const res = await apiFetch(`/api/benefits/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Demo: DELETE is blocked read-only — apiFetch already surfaced the
        // "Read-only demo" toast, so return gracefully (nothing was deleted, so
        // skip onChanged). In prod isDemoMode is false → fail loud as before.
        if (isDemoMode) return;
        console.error(`DELETE /api/benefits/${id} failed (status=${res.status})`);
        throw new Error(`Delete failed (${res.status})`);
      }
      onChanged();
    },
    [onChanged],
  );

  return { editBenefit, deleteBenefit };
}
