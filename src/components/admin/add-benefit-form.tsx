"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { COLORS } from "@/lib/ui/tokens";
import { EditField, ChipPicker, fieldInputStyle, resetWindowLabel } from "./edit-fields";
import { AddBenefitActions } from "./add-benefit-actions";
import type {
  BenefitWithPeriod,
  BenefitType,
  ResetPeriod,
  BenefitCategory,
} from "@/types/benefit";

const BENEFIT_TYPES: BenefitType[] = ["credit", "subscription", "access", "perk"];
const RESET_PERIODS: ResetPeriod[] = ["monthly", "quarterly", "semiannual", "annual", "once"];
const CATEGORIES: BenefitCategory[] = [
  "dining",
  "travel",
  "streaming",
  "shopping",
  "lounge",
  "general",
  "wellness",
];

/** Props for AddBenefitForm. */
export interface AddBenefitFormProps {
  userCardId: string;
  /** Called with the created benefit after a successful POST (so the list refreshes). */
  onCreated: (benefit: BenefitWithPeriod) => void;
  onCancel: () => void;
}

/** The five user-settable fields a manual benefit exposes (CONSTRAINT: no classification/tracked). */
interface FormDraft {
  name: string;
  value: number | null;
  resetPeriod: ResetPeriod;
  type: BenefitType;
  category: BenefitCategory;
}

const INITIAL: FormDraft = {
  name: "",
  value: null,
  resetPeriod: "monthly",
  type: "credit",
  category: "general",
};

/**
 * Inline add-benefit form (Task 84). Exposes EXACTLY name + per-window amount +
 * frequency + type + category — server sets source/tracked/classification, so
 * those fields are intentionally absent (mass-assignment SEC parity with the
 * POST route). The amount is per-window (CONSTRAINT-24): the label tells the user
 * which window. A failed POST shows a visible error and KEEPS the form open.
 */
export function AddBenefitForm({ userCardId, onCreated, onCancel }: AddBenefitFormProps) {
  const [draft, setDraft] = useState<FormDraft>(INITIAL);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = draft.name.trim().length > 0;

  function update(patch: Partial<FormDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  async function save() {
    if (!nameValid || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await apiFetch("/api/benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCardId,
          name: draft.name.trim(),
          value: draft.value,
          resetPeriod: draft.resetPeriod,
          type: draft.type,
          category: draft.category,
        }),
      });
      if (!res.ok) {
        // Demo: POST /api/benefits is blocked read-only — apiFetch already fired
        // the "Read-only demo" toast. Reset pending and keep the form open
        // without a failure message. In prod isDemoMode is false → throws below.
        if (isDemoMode) {
          setPending(false);
          return;
        }
        throw new Error(`POST /api/benefits returned ${res.status}`);
      }
      const created = (await res.json()) as BenefitWithPeriod;
      onCreated(created);
    } catch (err) {
      console.error(`add benefit failed (userCardId=${userCardId})`, err);
      setError("Could not add benefit — try again.");
      setPending(false);
    }
  }

  return (
    <div style={{ padding: "4px 14px 16px", borderTop: `1px solid ${COLORS.hairline}` }}>
      <EditField label="Benefit name">
        <input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-label="Benefit name"
          placeholder="e.g. Dining credit"
          style={{
            ...fieldInputStyle,
            borderColor: nameValid || draft.name === "" ? COLORS.hairline2 : COLORS.amber,
          }}
        />
      </EditField>

      <EditField label={`Amount (${resetWindowLabel(draft.resetPeriod)})`}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 2, ...fieldInputStyle, padding: "9px 11px" }}
        >
          <span style={{ color: COLORS.text3, fontSize: 14 }}>$</span>
          <input
            type="number"
            min={0}
            value={draft.value ?? ""}
            onChange={(e) =>
              update({ value: e.target.value ? Math.max(0, Number(e.target.value)) : null })
            }
            aria-label="Amount"
            placeholder="0"
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
      </EditField>

      <EditField label="Type">
        <ChipPicker
          ariaLabel="Type"
          options={BENEFIT_TYPES}
          value={draft.type}
          onPick={(v) => update({ type: v })}
        />
      </EditField>

      <EditField label="Resets">
        <ChipPicker
          ariaLabel="Reset period"
          options={RESET_PERIODS}
          value={draft.resetPeriod}
          onPick={(v) => update({ resetPeriod: v })}
        />
      </EditField>

      <EditField label="Category">
        <ChipPicker
          ariaLabel="Category"
          options={CATEGORIES}
          value={draft.category}
          onPick={(v) => update({ category: v })}
        />
      </EditField>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: COLORS.amber,
            marginBottom: 11,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <AddBenefitActions
        disabled={!nameValid || pending}
        pending={pending}
        onCancel={onCancel}
        onSave={save}
      />
    </div>
  );
}
