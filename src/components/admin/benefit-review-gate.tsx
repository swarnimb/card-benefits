"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BenefitEditRow } from "./benefit-edit-row";
import { ExcludedDisclosure, type IndexedBenefit } from "./excluded-disclosure";
import type { DraftBenefit } from "@/types/benefit";

/** Props for BenefitReviewGate. */
export interface BenefitReviewGateProps {
  userCardId: string;
  initialBenefits: DraftBenefit[];
  scrapeError?: string | null;
  parseError?: string | null;
  onSave: () => void;
  /**
   * Cancel handler. May be async — the gate awaits it and surfaces any thrown
   * error in `cancelError` rather than silently swallowing (EH-01). Used by
   * the admin page to DELETE orphan cards on fresh-add cancel (NEW-1).
   */
  onCancel: () => Promise<void> | void;
}

function makeBlankBenefit(): DraftBenefit {
  return {
    name: "",
    description: null,
    type: "credit",
    value: null,
    valueUnit: "dollars",
    resetPeriod: "monthly",
    resetAnchor: "calendar",
    category: "general",
    classification: "discretionary-credit",
    tracked: true,
    setAndForget: false,
    confidence: 1,
  };
}

/** Review gate — user must confirm all LLM-parsed benefits before DB write. */
export function BenefitReviewGate({
  userCardId,
  initialBenefits,
  scrapeError,
  parseError,
  onSave,
  onCancel,
}: BenefitReviewGateProps) {
  const [benefits, setBenefits] = useState<DraftBenefit[]>(initialBenefits);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  // Cancel state — `onCancel` may be async (admin orphan-card rollback).
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const errorMessage = scrapeError || parseError;

  const handleCancelClick = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await onCancel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel failed";
      console.error(
        `BenefitReviewGate cancel failed (userCardId=${userCardId})`,
        error,
      );
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  }, [onCancel, userCardId]);

  // Partition for DISPLAY only. `benefits` always holds every row (tracked +
  // excluded) so the confirm payload never drops an excluded benefit (A10).
  const indexed: IndexedBenefit[] = benefits.map((benefit, index) => ({
    benefit,
    index,
  }));
  const trackedItems = indexed.filter((item) => item.benefit.tracked);
  const excludedItems = indexed.filter((item) => !item.benefit.tracked);

  const updateBenefit = useCallback((index: number, updated: DraftBenefit) => {
    setBenefits((prev) => prev.map((b, i) => (i === index ? updated : b)));
  }, []);

  const removeBenefit = useCallback((index: number) => {
    setBenefits((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addBenefit = useCallback(() => {
    setBenefits((prev) => [...prev, makeBlankBenefit()]);
  }, []);

  const handleSave = useCallback(async () => {
    setTriedSave(true);
    setSaveError(null);

    const hasEmptyName = benefits.some((b) => !b.name.trim());
    if (hasEmptyName) return;

    setSaving(true);
    try {
      const res = await fetch("/api/benefits/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCardId, benefits }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        setSaveError(data.error || "Save failed");
        return;
      }
      onSave();
    } catch (error) {
      console.error(
        `benefits/confirm save failed (userCardId=${userCardId}, ${benefits.length} benefits)`,
        error
      );
      setSaveError("Network error — could not save");
    } finally {
      setSaving(false);
    }
  }, [benefits, userCardId, onSave]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-muted-foreground">Review Benefits</p>
        <button
          onClick={handleCancelClick}
          disabled={saving || cancelling}
          className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Cancel and close"
        >
          <X className="size-4" />
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">{errorMessage}</p>
            <p className="text-muted-foreground">Add benefits manually below</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {trackedItems.map(({ benefit, index }) => (
          <BenefitEditRow
            key={index}
            benefit={benefit}
            onChange={(updated) => updateBenefit(index, updated)}
            onRemove={() => removeBenefit(index)}
            showNameError={triedSave}
          />
        ))}
      </div>

      {excludedItems.length > 0 && (
        <ExcludedDisclosure
          items={excludedItems}
          expanded={showExcluded}
          onToggle={() => setShowExcluded((v) => !v)}
          onChange={updateBenefit}
          onRemove={removeBenefit}
          showNameError={triedSave}
        />
      )}

      <Button variant="outline" size="sm" onClick={addBenefit}>
        <Plus className="size-4" />
        Add benefit
      </Button>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      {cancelError && (
        <p className="text-sm text-destructive" role="alert" data-testid="cancel-error">
          {cancelError}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={benefits.length === 0 || saving || cancelling}>
          {saving ? "Saving..." : `Save ${benefits.length} benefit${benefits.length !== 1 ? "s" : ""}`}
        </Button>
        <Button variant="outline" onClick={handleCancelClick} disabled={saving || cancelling}>
          {cancelling ? "Cancelling..." : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
