"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { COLORS, EASING_ARRAY, RADII } from "@/lib/ui/tokens";
import { BenefitAmount } from "./edit-fields";
import { BenefitEditPanel } from "./benefit-edit-panel";
import { BenefitDeleteConfirm } from "./benefit-delete-confirm";
import { ChevronDown } from "./icons";
import type { BenefitWithPeriod, DraftBenefit } from "@/types/benefit";
import type { BenefitPatch } from "@/hooks/use-benefit-mutations";

/** Props for ManagedBenefitRow. */
export interface ManagedBenefitRowProps {
  benefit: BenefitWithPeriod;
  /** PATCH the benefit with an allowlisted field patch; rejects on failure. */
  onEdit: (id: string, patch: BenefitPatch) => Promise<void>;
  /** DELETE the benefit (after the inline confirm); rejects on failure. */
  onDelete: (id: string) => Promise<void>;
}

/** Map a persisted benefit → the DraftBenefit shape BenefitEditPanel edits. */
function toDraft(b: BenefitWithPeriod): DraftBenefit {
  return {
    name: b.name,
    description: b.description,
    type: b.type,
    value: b.value,
    valueUnit: b.valueUnit,
    resetPeriod: b.resetPeriod,
    resetAnchor: b.resetAnchor,
    category: b.category,
    classification: b.classification,
    tracked: b.tracked,
    setAndForget: b.setAndForget,
    confidence: "high", // review-only field; not persisted — neutral default for editing
  };
}

const TextButton = ({
  label,
  onClick,
  destructive,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    style={{
      padding: "6px 10px",
      borderRadius: RADII.chip,
      cursor: "pointer",
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${COLORS.hairline2}`,
      color: destructive ? COLORS.amber : COLORS.text2,
      fontSize: 11.5,
      fontWeight: 500,
      fontFamily: "inherit",
    }}
  >
    {label}
  </button>
);

/**
 * One benefit line inside an expanded managed card (Task 83/85): name +
 * per-window `BenefitAmount`, with Edit (toggles an inline `BenefitEditPanel`)
 * and Delete (opens an inline confirm BEFORE any DELETE). The panel's "Discard"
 * is re-routed to the same delete-confirm, never an unconfirmed delete.
 */
export function ManagedBenefitRow({ benefit, onEdit, onDelete }: ManagedBenefitRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<DraftBenefit>(() => toDraft(benefit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInvalid = !draft.name.trim();

  function openEdit() {
    setDraft(toDraft(benefit));
    setError(null);
    setEditing((o) => !o);
  }

  async function save() {
    if (nameInvalid || saving) return;
    setSaving(true);
    setError(null);
    const patch: BenefitPatch = {
      name: draft.name.trim(),
      type: draft.type,
      value: draft.value,
      resetPeriod: draft.resetPeriod,
      resetAnchor: draft.resetAnchor,
      category: draft.category,
    };
    try {
      await onEdit(benefit.id, patch);
      setEditing(false);
    } catch {
      setError("Could not save changes — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setConfirming(false);
    setError(null);
    try {
      await onDelete(benefit.id);
    } catch {
      setError("Could not delete benefit — try again.");
    }
  }

  return (
    <div
      data-testid="managed-benefit-row"
      style={{
        borderRadius: RADII.button,
        overflow: "hidden",
        background: COLORS.surface2,
        border: `1px solid ${COLORS.hairline}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: COLORS.text,
              letterSpacing: -0.15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {benefit.name}
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
            <TextButton label="Edit" onClick={openEdit} />
            <TextButton label="Delete" onClick={() => setConfirming(true)} destructive />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <BenefitAmount value={benefit.value} resetPeriod={benefit.resetPeriod} />
          <motion.span
            style={{ display: "inline-flex", color: COLORS.text4 }}
            animate={{ rotate: editing ? 180 : 0 }}
            transition={{ duration: 0.3, ease: EASING_ARRAY }}
          >
            {ChevronDown}
          </motion.span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0 13px 11px",
            fontSize: 11.5,
            color: COLORS.amber,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <BenefitEditPanel
        benefit={draft}
        open={editing}
        low={false}
        nameInvalid={nameInvalid}
        update={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onRemove={() => {
          setEditing(false);
          setConfirming(true);
        }}
      />

      {editing && (
        <div style={{ padding: "0 14px 14px" }}>
          <button
            type="button"
            onClick={save}
            disabled={nameInvalid || saving}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: RADII.input + 1,
              cursor: nameInvalid || saving ? "default" : "pointer",
              background: COLORS.amber,
              border: "1px solid transparent",
              color: COLORS.onAmber,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              opacity: nameInvalid || saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}

      <BenefitDeleteConfirm
        open={confirming}
        name={benefit.name}
        onKeep={() => setConfirming(false)}
        onRemove={confirmDelete}
      />
    </div>
  );
}
