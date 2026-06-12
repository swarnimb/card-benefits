"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { apiFetch } from "@/lib/demo/demo-api";

/** Props for the sticky set-and-forget activation toggle. */
export interface ActivationToggleProps {
  benefitId: string;
  /** Drives on/off — active when non-null. Period-independent (sticky). */
  activatedAt: Date | null;
  cardColor: string;
  /**
   * Sync callback invoked AFTER a successful activation PATCH so the parent
   * list re-renders with the new value. The PATCH itself is owned here
   * (mirrors the tracked-toggle pattern). Optional — without it the toggle
   * still works but parent state is not updated until refetch.
   */
  onActivated?: (benefitId: string, activatedAt: Date | null) => void;
}

/** Spring snap spec from design-decisions.md */
const SNAP_SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };
const COLOR_INACTIVE = "#374151";

/**
 * Set-and-forget activation toggle — "Set up" when inactive, "✓ Active" when
 * activated. Sticky: bound to `activatedAt` (not a period), so it survives
 * period rollovers. Writes go through PATCH /api/benefits/[id]/activation only
 * (CONSTRAINT-16); the component owns the request and flips optimistically.
 */
export function ActivationToggle({ benefitId, activatedAt, cardColor, onActivated }: ActivationToggleProps) {
  const reducedMotion = useReducedMotion();
  const [activeLocal, setActiveLocal] = useState<boolean>(activatedAt !== null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    if (saving) return;
    const next = !activeLocal;
    const prev = activeLocal;
    setActiveLocal(next);
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/benefits/${benefitId}/activation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activated: next }),
      });
      if (!res.ok) {
        setActiveLocal(prev);
        setError("Could not update — try again");
        console.error(`PATCH /api/benefits/${benefitId}/activation returned ${res.status}`);
        return;
      }
      const updated = await res.json();
      onActivated?.(benefitId, updated.activatedAt ? new Date(updated.activatedAt) : null);
    } catch (err) {
      setActiveLocal(prev);
      setError("Network error — try again");
      console.error(`PATCH /api/benefits/${benefitId}/activation failed:`, err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <motion.button
        type="button"
        data-testid={`activation-toggle-${benefitId}`}
        onClick={handleClick}
        disabled={saving}
        aria-pressed={activeLocal}
        aria-label={`${activeLocal ? "Active" : "Set up"} automatic benefit`}
        animate={{ backgroundColor: activeLocal ? cardColor : COLOR_INACTIVE }}
        transition={reducedMotion ? { duration: 0 } : SNAP_SPRING}
        className="flex items-center gap-2 rounded-full px-4 min-h-[48px] min-w-[128px] justify-center focus:outline-none disabled:opacity-50"
      >
        {activeLocal && (
          <span className="text-sm text-[#F9F9F8]" aria-hidden="true">✓</span>
        )}
        <span className="text-sm font-medium text-[#F9F9F8]">
          {activeLocal ? "Active" : "Set up"}
        </span>
      </motion.button>
      {error && (
        <p className="text-xs text-destructive mt-1" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
