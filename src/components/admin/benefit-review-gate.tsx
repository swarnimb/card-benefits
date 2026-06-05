"use client";

import { useState, useCallback } from "react";
import { COLORS, RADII } from "@/lib/ui/tokens";
import { usd } from "@/components/overview/format";
import { FlowShell } from "./flow-shell";
import { BenefitEditRow } from "./benefit-edit-row";
import { ExcludedDisclosure, type IndexedBenefit } from "./excluded-disclosure";
import { CheckIcon, PlusIcon, SparkIcon } from "./icons";
import type { DraftBenefit } from "@/types/benefit";

/** Props for BenefitReviewGate. */
export interface BenefitReviewGateProps {
  userCardId: string;
  initialBenefits: DraftBenefit[];
  /** Card subtitle ("{issuer} {name}") for the flow header; optional. */
  cardName?: string | null;
  /**
   * Scrape-derived card annual fee (USD), pre-filled into the editable fee input;
   * null when the parser found none (A11). Confirmed on save → Card.annualFee
   * (CONSTRAINT-21). Optional so callers/tests that omit it default to null.
   */
  initialAnnualFee?: number | null;
  scrapeError?: string | null;
  parseError?: string | null;
  onSave: () => void;
  /**
   * Cancel handler. May be async — the gate awaits it and surfaces any thrown
   * error in `cancelError` (EH-01). Used by the admin page to DELETE orphan cards
   * on fresh-add cancel (NEW-1).
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
    // User-authored → high confidence (review-only; stripped before persistence).
    confidence: "high",
  };
}

const feeInputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: COLORS.bg,
  border: `1px solid ${COLORS.hairline2}`,
  borderRadius: RADII.input,
  padding: "9px 11px",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

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
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: RADII.button,
            cursor: saveDisabled ? "not-allowed" : "pointer",
            background: saveDisabled ? "rgba(255,255,255,0.06)" : COLORS.amber,
            border: "none",
            color: saveDisabled ? COLORS.text4 : "#1A1208",
            fontSize: 14.5,
            fontWeight: 600,
            fontFamily: "inherit",
            letterSpacing: -0.1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {!saveDisabled && <CheckIcon s={13} />}
          {saveLabel}
        </button>
      }
    >
      {/* AI banner */}
      <div style={{ padding: "0 16px 14px" }}>
        <div
          style={{
            padding: "13px 15px",
            borderRadius: RADII.button,
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${COLORS.hairline}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: RADII.icon - 1,
                background: COLORS.amberSoft,
                color: COLORS.amber,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {SparkIcon}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, letterSpacing: -0.1 }}>
              AI found {benefits.length} benefit{benefits.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.text3, lineHeight: 1.5 }}>
            {lowCount > 0 ? (
              <>
                Check the {lowCount} marked{" "}
                <span style={{ color: COLORS.amber, fontWeight: 500 }}>Review</span>, edit anything,
                then confirm. Nothing is saved until you do.
              </>
            ) : (
              <>Edit anything that looks off, then confirm. Nothing is saved until you do.</>
            )}
          </div>
        </div>
      </div>

      {/* scrape/parse error banner */}
      {errorMessage && (
        <div style={{ padding: "0 16px 14px" }}>
          <div
            style={{
              padding: "13px 15px",
              borderRadius: RADII.button,
              background: COLORS.amberSoft,
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.amber }}>{errorMessage}</div>
            <div style={{ fontSize: 12, color: COLORS.text3, marginTop: 4 }}>
              Add benefits manually below
            </div>
          </div>
        </div>
      )}

      {/* tracked benefit rows */}
      <div
        style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 9 }}
      >
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

      {/* excluded disclosure (A10) */}
      {excludedItems.length > 0 && (
        <div style={{ padding: "0 16px 12px" }}>
          <ExcludedDisclosure
            items={excludedItems}
            expanded={showExcluded}
            onToggle={() => setShowExcluded((v) => !v)}
            onChange={updateBenefit}
            onRemove={removeBenefit}
            showNameError={triedSave}
          />
        </div>
      )}

      {/* add benefit */}
      <div style={{ padding: "0 16px 12px" }}>
        <button
          type="button"
          onClick={addBenefit}
          aria-label="Add benefit"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 13px",
            borderRadius: RADII.input + 1,
            cursor: "pointer",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${COLORS.hairline2}`,
            color: COLORS.text2,
            fontSize: 12.5,
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        >
          {PlusIcon} Add benefit
        </button>
      </div>

      {/* editable annual fee (CONSTRAINT-21) */}
      <div style={{ padding: "0 16px 12px" }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: 0.7,
            color: COLORS.text3,
            textTransform: "uppercase",
            marginBottom: 7,
          }}
        >
          Annual fee
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, ...feeInputStyle, width: 140 }}>
          <span style={{ color: COLORS.text3, fontSize: 14 }}>$</span>
          <input
            id="annual-fee"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={annualFeeInput}
            onChange={(e) => setAnnualFeeInput(e.target.value)}
            placeholder="—"
            aria-label="Annual fee in dollars"
            style={{
              background: "transparent",
              border: 0,
              outline: "none",
              color: COLORS.text,
              fontSize: 14,
              fontFamily: "inherit",
              width: "100%",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </div>
      </div>

      {/* running total */}
      <div
        style={{
          margin: "0 16px 8px",
          padding: "12px 15px",
          borderRadius: RADII.control,
          background: "rgba(255,255,255,0.02)",
          border: `1px dashed ${COLORS.hairline2}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 12.5, color: COLORS.text3 }}>
          {trackedItems.length} of {benefits.length} tracked
        </span>
        <span style={{ fontSize: 13, color: COLORS.text2 }}>
          up to{" "}
          <span style={{ color: COLORS.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {usd(trackedTotal)}
          </span>
          /yr tracked
        </span>
      </div>

      {/* error surfaces */}
      {saveError && (
        <p style={{ padding: "0 16px 8px", fontSize: 12.5, color: COLORS.amber }} role="alert">
          {saveError}
        </p>
      )}
      {cancelError && (
        <p
          style={{ padding: "0 16px 12px", fontSize: 12.5, color: COLORS.amber }}
          role="alert"
          data-testid="cancel-error"
        >
          {cancelError}
        </p>
      )}
    </FlowShell>
  );
}
