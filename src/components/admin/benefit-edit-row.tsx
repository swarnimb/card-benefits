"use client";

import { X, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DraftBenefit, BenefitType, ResetPeriod, ResetAnchor, BenefitCategory, ValueUnit } from "@/types/benefit";

const BENEFIT_TYPES: BenefitType[] = ["credit", "subscription", "access", "perk"];
const VALUE_UNITS: ValueUnit[] = ["dollars", "points"];
const RESET_PERIODS: ResetPeriod[] = ["monthly", "quarterly", "semiannual", "annual", "once"];
const RESET_ANCHORS: ResetAnchor[] = ["calendar", "statement", "anniversary"];
const CATEGORIES: BenefitCategory[] = ["dining", "travel", "streaming", "shopping", "lounge", "general"];

/** Props for BenefitEditRow. */
export interface BenefitEditRowProps {
  benefit: DraftBenefit;
  onChange: (updated: DraftBenefit) => void;
  onRemove: () => void;
  showNameError?: boolean;
}

function SelectField<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 rounded-md border border-input bg-[#1A1917] text-[#F9F9F8] px-2 text-sm"
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#1A1917] text-[#F9F9F8]">
          {opt}
        </option>
      ))}
    </select>
  );
}

/** Editable row for a single draft benefit in the review gate. */
export function BenefitEditRow({ benefit, onChange, onRemove, showNameError }: BenefitEditRowProps) {
  const nameInvalid = showNameError && !benefit.name.trim();

  function update(patch: Partial<DraftBenefit>) {
    onChange({ ...benefit, ...patch });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <Input
          placeholder="Benefit name"
          value={benefit.name}
          onChange={(e) => update({ name: e.target.value })}
          className={nameInvalid ? "border-destructive" : ""}
          aria-label="Benefit name"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove benefit"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {nameInvalid && <p className="text-xs text-destructive">Name is required</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SelectField label="Type" value={benefit.type} options={BENEFIT_TYPES} onChange={(v) => update({ type: v })} />
        <div className="flex gap-1">
          <Input
            type="number"
            placeholder="Value"
            value={benefit.value ?? ""}
            onChange={(e) => update({ value: e.target.value ? Number(e.target.value) : null })}
            aria-label="Value"
            className="flex-1"
          />
          <SelectField label="Value unit" value={benefit.valueUnit} options={VALUE_UNITS} onChange={(v) => update({ valueUnit: v })} />
        </div>
        <SelectField label="Reset period" value={benefit.resetPeriod} options={RESET_PERIODS} onChange={(v) => update({ resetPeriod: v })} />
        <SelectField label="Category" value={benefit.category} options={CATEGORIES} onChange={(v) => update({ category: v })} />
      </div>
      {/*
        Tracked toggle (added 2026-05-26): user can override the deterministic
        classification→tracked mapping at confirm time. Flipping it moves the
        row between the tracked section and the excluded disclosure on
        re-render (BenefitReviewGate partitions by `benefit.tracked`).
        `classification` itself remains server-only / non-editable.
      */}
      <div className="flex items-center justify-between gap-2">
        <SelectField label="Reset anchor" value={benefit.resetAnchor} options={RESET_ANCHORS} onChange={(v) => update({ resetAnchor: v })} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => update({ tracked: !benefit.tracked })}
            aria-label="Toggle tracked"
            aria-pressed={benefit.tracked}
            title={benefit.tracked ? "Currently tracked — click to exclude" : "Currently excluded — click to track"}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            {benefit.tracked ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          {benefit.setAndForget && (
            <span
              className="rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
              aria-label="Set and forget"
              title="Set-and-forget — activate once; not tracked per period"
            >
              Auto
            </span>
          )}
          <span
            className="text-xs uppercase tracking-wider text-muted-foreground"
            aria-label="Classification"
            title="Classification (set automatically — not editable)"
          >
            {benefit.classification}
          </span>
        </div>
      </div>
    </div>
  );
}
