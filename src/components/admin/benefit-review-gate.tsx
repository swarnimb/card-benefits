"use client";

import { useState, useCallback } from "react";
import { FlowShell } from "./flow-shell";
import { type IndexedBenefit } from "./excluded-disclosure";
import { GateBenefitList } from "./gate-benefit-list";
import {
  AiBanner,
  ScrapeErrorBanner,
  AnnualFeeField,
  RunningTotal,
  GateErrorMessage,
} from "./review-gate-parts";
import {
  makeBlankBenefit,
  ConfirmFooterButton,
  AddBenefitButton,
} from "./review-gate-controls";
import type { DraftBenefit } from "@/types/benefit";

/** Props for BenefitReviewGate. */
export interface BenefitReviewGateProps {
  userCardId: string;
  initialBenefits: DraftBenefit[];
  /** Card subtitle ("{issuer} {name}") for the flow header; optional. */
  cardName?: string | null;
  /** Scrape-derived annual fee (USD), pre-filled into the fee input; null when none found (A11). Confirmed on save → Card.annualFee (CONSTRAINT-21). */
  initialAnnualFee?: number | null;
  scrapeError?: string | null;
  parseError?: string | null;
  onSave: () => void;
  /** Cancel handler. May be async — the gate awaits it and surfaces a thrown error in `cancelError` (EH-01); admin page DELETEs orphan cards on fresh-add cancel (NEW-1). */
  onCancel: () => Promise<void> | void;
}

/**
 * Review gate (design source `Review`) — the user must confirm all LLM-parsed
 * benefits before any DB write (CONSTRAINT-10). Restyled into the full-screen
 * FlowShell with an AI banner, a sticky-footer confirm, and a running total.
 * Preserves: confidence badge/note (review-only), the editable annual-fee field
 * (CONSTRAINT-21), the excluded-benefits disclosure (A10), full editability, and
 * the loud cancel/save error surfaces (EH-01).
 */
export function BenefitReviewGate({
  userCardId,
  initialBenefits,
  cardName,
  initialAnnualFee = null,
  scrapeError,
  parseError,
  onSave,
  onCancel,
}: BenefitReviewGateProps) {
  const [benefits, setBenefits] = useState<DraftBenefit[]>(initialBenefits);
  // Annual fee held as the raw input STRING so it can be cleared to "" (→ null).
  const [annualFeeInput, setAnnualFeeInput] = useState<string>(
    initialAnnualFee === null || initialAnnualFee === undefined ? "" : String(initialAnnualFee),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
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
      console.error(`BenefitReviewGate cancel failed (userCardId=${userCardId})`, error);
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  }, [onCancel, userCardId]);

  // Partition for DISPLAY only. `benefits` always holds every row (A10).
  const indexed: IndexedBenefit[] = benefits.map((benefit, index) => ({ benefit, index }));
  const trackedItems = indexed.filter((item) => item.benefit.tracked);
  const excludedItems = indexed.filter((item) => !item.benefit.tracked);
  const lowCount = benefits.filter((b) => b.confidence === "low").length;
  const trackedTotal = trackedItems.reduce(
    (sum, { benefit }) => sum + (benefit.value && benefit.value > 0 ? benefit.value : 0),
    0,
  );

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

    if (benefits.some((b) => !b.name.trim())) return;

    // Resolve fee to number|null. Non-empty non-(finite,>=0) → LOUD error (EH-01).
    const trimmedFee = annualFeeInput.trim();
    let annualFee: number | null = null;
    if (trimmedFee !== "") {
      const parsed = Number(trimmedFee);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setSaveError("Annual fee must be a non-negative number (or left blank).");
        return;
      }
      annualFee = parsed;
    }

    setSaving(true);
    try {
      // SOLE write path (CONSTRAINT-10): all benefits (tracked + excluded) sent.
      const res = await fetch("/api/benefits/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCardId, benefits, annualFee }),
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
        error,
      );
      setSaveError("Network error — could not save");
    } finally {
      setSaving(false);
    }
  }, [benefits, annualFeeInput, userCardId, onSave]);

  const saveDisabled = benefits.length === 0 || saving || cancelling;
  const saveLabel = saving
    ? "Saving..."
    : `Save ${benefits.length} benefit${benefits.length !== 1 ? "s" : ""}`;

  return (
    <FlowShell
      title="Review benefits"
      subtitle={cardName}
      onClose={handleCancelClick}
      closeLabel="Cancel"
      footer={
        <ConfirmFooterButton label={saveLabel} disabled={saveDisabled} onClick={handleSave} />
      }
    >
      <AiBanner benefitCount={benefits.length} lowCount={lowCount} />

      {errorMessage && <ScrapeErrorBanner message={errorMessage} />}

      <GateBenefitList
        trackedItems={trackedItems}
        excludedItems={excludedItems}
        showExcluded={showExcluded}
        onToggleExcluded={() => setShowExcluded((v) => !v)}
        updateBenefit={updateBenefit}
        removeBenefit={removeBenefit}
        triedSave={triedSave}
      />

      <AddBenefitButton onClick={addBenefit} />

      <AnnualFeeField value={annualFeeInput} onChange={setAnnualFeeInput} />

      <RunningTotal
        trackedCount={trackedItems.length}
        totalCount={benefits.length}
        trackedTotal={trackedTotal}
      />

      {/* error surfaces */}
      {saveError && <GateErrorMessage message={saveError} />}
      {cancelError && (
        <GateErrorMessage message={cancelError} testId="cancel-error" padBottom={12} />
      )}
    </FlowShell>
  );
}
