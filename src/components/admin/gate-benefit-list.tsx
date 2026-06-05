"use client";

import { BenefitEditRow } from "./benefit-edit-row";
import { ExcludedDisclosure, type IndexedBenefit } from "./excluded-disclosure";
import type { DraftBenefit } from "@/types/benefit";

/**
 * Benefit-list body of the review gate: the tracked rows plus the excluded
 * disclosure (A10). Extracted to keep `benefit-review-gate` (state/handlers/
 * confirm logic) < 200 lines. Pure render — the gate still owns all state and
 * the update/remove callbacks passed in here.
 */
export function GateBenefitList({
  trackedItems,
  excludedItems,
  showExcluded,
  onToggleExcluded,
  updateBenefit,
  removeBenefit,
  triedSave,
}: {
  trackedItems: IndexedBenefit[];
  excludedItems: IndexedBenefit[];
  showExcluded: boolean;
  onToggleExcluded: () => void;
  updateBenefit: (index: number, updated: DraftBenefit) => void;
  removeBenefit: (index: number) => void;
  triedSave: boolean;
}) {
  return (
    <>
      {/* tracked benefit rows */}
      <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 9 }}>
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
            onToggle={onToggleExcluded}
            onChange={updateBenefit}
            onRemove={removeBenefit}
            showNameError={triedSave}
          />
        </div>
      )}
    </>
  );
}
