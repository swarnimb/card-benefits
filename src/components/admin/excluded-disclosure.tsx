"use client";

import { ChevronDown } from "lucide-react";
import { BenefitEditRow } from "./benefit-edit-row";
import type { DraftBenefit } from "@/types/benefit";

/** A draft benefit paired with its stable index in the full benefits array. */
export interface IndexedBenefit {
  benefit: DraftBenefit;
  index: number;
}

/** Props for ExcludedDisclosure. */
export interface ExcludedDisclosureProps {
  items: IndexedBenefit[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (index: number, updated: DraftBenefit) => void;
  onRemove: (index: number) => void;
  showNameError: boolean;
}

/**
 * Collapsed disclosure for auto-excluded (tracked=false) benefits. Excluded
 * rows stay in the parent's state and confirm payload at all times — this
 * only controls visibility (assumption A10: never drop excluded benefits).
 */
export function ExcludedDisclosure({
  items,
  expanded,
  onToggle,
  onChange,
  onRemove,
  showNameError,
}: ExcludedDisclosureProps) {
  return (
    <div className="rounded-md border border-white/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>
          {items.length} auto-excluded as non-trackable — expand to review
        </span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-white/10 p-3">
          {items.map(({ benefit, index }) => (
            <BenefitEditRow
              key={index}
              benefit={benefit}
              onChange={(updated) => onChange(index, updated)}
              onRemove={() => onRemove(index)}
              showNameError={showNameError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
