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
  onCancel: () => void;
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

  const errorMessage = scrapeError || parseError;

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
          onClick={onCancel}
          disabled={saving}
          className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
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

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={benefits.length === 0 || saving}>
          {saving ? "Saving..." : `Save ${benefits.length} benefit${benefits.length !== 1 ? "s" : ""}`}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
