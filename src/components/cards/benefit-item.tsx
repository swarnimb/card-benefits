"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { BenefitWithPeriod } from "@/types/benefit";
import { apiFetch } from "@/lib/demo/demo-api";
import { COLORS } from "@/lib/ui/tokens";
import { UsageSlider } from "./usage-slider";
import { UsageToggle } from "./usage-toggle";
import { UsageCounter } from "./usage-counter";
import { ActivationToggle } from "./activation-toggle";

/** Props for a single benefit row with its usage control. */
export interface BenefitItemProps {
  benefit: BenefitWithPeriod;
  cardColor: string;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
  /**
   * Sync callback invoked AFTER a successful tracked PATCH so the parent list
   * can re-render with the new value. The PATCH itself is owned here (this
   * component fires it directly, mirroring the brief). Optional — if omitted,
   * the toggle still works but parent state is not updated until refetch.
   */
  onTrackedUpdate?: (benefitId: string, newTracked: boolean) => void;
  /**
   * Sync callback invoked AFTER a successful activation PATCH (set-and-forget
   * benefits). The PATCH is owned by ActivationToggle; this syncs parent state.
   */
  onActivated?: (benefitId: string, activatedAt: Date | null) => void;
}

const EXPIRING_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const COLOR_COMPLETE = "#4ADE80";

/** Formats a numeric value with the appropriate unit prefix/suffix. */
function formatValue(amount: number, unit: string): string {
  if (unit === "points") return `${amount.toLocaleString()} pts`;
  return `$${amount.toLocaleString()}`;
}

function isExpiringSoon(benefit: BenefitWithPeriod): boolean {
  const end = benefit.currentPeriod?.periodEnd;
  if (!end) return false;
  const daysLeft = (new Date(end).getTime() - Date.now()) / MS_PER_DAY;
  return daysLeft >= 0 && daysLeft <= EXPIRING_DAYS;
}

function daysUntilReset(benefit: BenefitWithPeriod): number | null {
  const end = benefit.currentPeriod?.periodEnd;
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / MS_PER_DAY);
}

/**
 * Single benefit row — name, description, expiring label, and inline tracking UI.
 */
export function BenefitItem({ benefit, cardColor, onUsageUpdate, onTrackedUpdate, onActivated }: BenefitItemProps) {
  // Optimistic tracked state: flip immediately on click, revert if PATCH fails.
  // Synced via key=benefit.id so a parent refetch resets it to the server value.
  const [trackedLocal, setTrackedLocal] = useState<boolean>(benefit.tracked);
  const [trackedError, setTrackedError] = useState<string | null>(null);
  const [savingTracked, setSavingTracked] = useState(false);

  const expiring = isExpiringSoon(benefit);
  const daysLeft = expiring ? daysUntilReset(benefit) : null;
  const usedAmount = benefit.currentPeriod?.usedAmount ?? 0;
  const isComplete = benefit.value !== null && usedAmount >= benefit.value;
  const sliderColor = isComplete ? COLOR_COMPLETE : cardColor;

  async function handleTrackedToggle() {
    if (savingTracked) return;
    const newValue = !trackedLocal;
    const prev = trackedLocal;
    setTrackedLocal(newValue);
    setTrackedError(null);
    setSavingTracked(true);
    try {
      const res = await apiFetch(`/api/benefits/${benefit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracked: newValue }),
      });
      if (!res.ok) {
        setTrackedLocal(prev);
        setTrackedError("Could not update — try again");
        console.error(`PATCH /api/benefits/${benefit.id} tracked toggle returned ${res.status}`);
        return;
      }
      onTrackedUpdate?.(benefit.id, newValue);
    } catch (err) {
      setTrackedLocal(prev);
      setTrackedError("Network error — try again");
      console.error(`PATCH /api/benefits/${benefit.id} tracked toggle failed:`, err);
    } finally {
      setSavingTracked(false);
    }
  }

  return (
    <div
      className="px-4 py-3 last:border-0"
      style={{ borderBottom: `1px solid ${COLORS.hairline}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="min-w-0 flex-1 truncate font-medium"
          style={{ fontSize: 13.5, letterSpacing: -0.1, color: COLORS.text }}
        >
          {benefit.name}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {benefit.value !== null && (
            <span
              className="font-semibold"
              style={{ fontSize: 13.5, color: COLORS.text, fontVariantNumeric: "tabular-nums" }}
            >
              {formatValue(benefit.value, benefit.valueUnit)}
            </span>
          )}
          <button
            type="button"
            onClick={handleTrackedToggle}
            disabled={savingTracked}
            aria-label="Toggle tracked"
            aria-pressed={trackedLocal}
            title={trackedLocal ? "Currently tracked — click to exclude from Overview" : "Currently excluded — click to track"}
            data-testid={`tracked-toggle-${benefit.id}`}
            className="rounded-md p-1 transition-colors hover:bg-white/10 disabled:opacity-50"
            style={{ color: COLORS.text3 }}
          >
            {trackedLocal ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
        </div>
      </div>
      {benefit.description && (
        <p className="mt-0.5 truncate" style={{ fontSize: 10.5, color: COLORS.text3 }}>
          {benefit.description}
        </p>
      )}
      {expiring && daysLeft !== null && (
        <p className="mt-1" style={{ fontSize: 10.5, color: COLORS.amber }}>
          ⚠ Resets in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
        </p>
      )}
      {trackedError && (
        <p className="mt-1 text-xs text-destructive" role="alert" aria-live="polite">
          {trackedError}
        </p>
      )}

      <div className="mt-2">
        {benefit.setAndForget ? (
          // Set-and-forget benefits get the sticky activation toggle instead of
          // a per-period usage widget (currentPeriod is null for them).
          <ActivationToggle
            benefitId={benefit.id}
            activatedAt={benefit.activatedAt}
            cardColor={cardColor}
            onActivated={onActivated}
          />
        ) : (
          <>
            {(benefit.type === "credit" || benefit.type === "perk") && (
              <UsageSlider
                benefitId={benefit.id}
                value={usedAmount}
                max={benefit.value}
                cardColor={sliderColor}
                onUpdate={(v) => onUsageUpdate(benefit.id, v)}
              />
            )}
            {benefit.type === "subscription" && (
              <UsageToggle
                benefitId={benefit.id}
                isActivated={usedAmount > 0}
                cardColor={cardColor}
                onUpdate={(v) => onUsageUpdate(benefit.id, v)}
              />
            )}
            {benefit.type === "access" && (
              <UsageCounter
                benefitId={benefit.id}
                count={usedAmount}
                max={benefit.value}
                onUpdate={(v) => onUsageUpdate(benefit.id, v)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
