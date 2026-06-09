"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { BenefitWithPeriod, BenefitType } from "@/types/benefit";
import { COLORS, TYPE, SPRING } from "@/lib/ui/tokens";
import { BenefitItem } from "./benefit-item";

/** Props for the scrollable benefits list inside an expanded card. */
export interface BenefitListProps {
  benefits: BenefitWithPeriod[];
  cardColor: string;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
  /** Optional sync callback invoked after a successful tracked PATCH so the parent list re-renders. */
  onTrackedUpdate?: (benefitId: string, newTracked: boolean) => void;
  /** Optional sync callback invoked after a successful activation PATCH (set-and-forget benefits). */
  onActivated?: (benefitId: string, activatedAt: Date | null) => void;
}

const GROUP_ORDER: BenefitType[] = ["credit", "subscription", "access", "perk"];

const GROUP_LABELS: Record<BenefitType, string> = {
  credit: "$Credits",
  subscription: "Subscriptions",
  access: "Access",
  perk: "One-time Perks",
};

/** Shared callbacks threaded down to every BenefitItem row. */
type RowCallbacks = Pick<BenefitListProps, "onUsageUpdate" | "onTrackedUpdate" | "onActivated">;

/** Renders BenefitItem rows for a set of benefits with the given card color. */
function renderRows(items: BenefitWithPeriod[], cardColor: string, cb: RowCallbacks) {
  return items.map((benefit) => (
    <BenefitItem
      key={benefit.id}
      benefit={benefit}
      cardColor={cardColor}
      onUsageUpdate={cb.onUsageUpdate}
      onTrackedUpdate={cb.onTrackedUpdate}
      onActivated={cb.onActivated}
    />
  ));
}

/**
 * Collapsed "N hidden — tap to expand" section for untracked benefits. Each row
 * keeps its eye toggle, so showing one fires the existing tracked PATCH and the
 * benefit re-partitions back into the main list on the next render.
 */
function HiddenBenefits({
  hidden,
  cardColor,
  cb,
}: {
  hidden: BenefitWithPeriod[];
  cardColor: string;
  cb: RowCallbacks;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid="hidden-benefits-toggle"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
        style={{ ...TYPE.label, color: COLORS.text4 }}
      >
        <span className="uppercase">
          {hidden.length} hidden — tap to {expanded ? "collapse" : "expand"}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={SPRING}
          className="shrink-0"
          style={{ color: COLORS.text4 }}
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            style={{ overflow: "hidden" }}
          >
            {renderRows(hidden, cardColor, cb)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Splits benefits into the tracked main list and a collapsed "hidden" section
 * for untracked ones. The tracked list keeps the existing grouping (credit →
 * subscription → access → perk, with set-and-forget pulled into a calm
 * "Automatic" group rendered last — PRD Feature 8). Toggling a benefit's eye
 * fires the existing tracked PATCH; when `tracked` flips, the partition below
 * recomputes and the row animates between sections.
 */
export function BenefitList({ benefits, cardColor, onUsageUpdate, onTrackedUpdate, onActivated }: BenefitListProps) {
  const cb: RowCallbacks = { onUsageUpdate, onTrackedUpdate, onActivated };

  const tracked = benefits.filter((b) => b.tracked);
  const hidden = benefits.filter((b) => !b.tracked);

  const periodic = tracked.filter((b) => !b.setAndForget);
  const automatic = tracked.filter((b) => b.setAndForget);

  return (
    <div>
      {GROUP_ORDER.map((type) => {
        const group = periodic.filter((b) => b.type === type);
        if (group.length === 0) return null;

        return (
          <div key={type}>
            <p
              className="px-4 pb-1 pt-3 uppercase"
              style={{ ...TYPE.label, color: COLORS.text3 }}
            >
              {GROUP_LABELS[type]}
            </p>
            {renderRows(group, cardColor, cb)}
          </div>
        );
      })}

      {automatic.length > 0 && (
        <div className="mt-2" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
          <p
            className="px-4 pb-1 pt-3 uppercase"
            style={{ ...TYPE.label, color: COLORS.text4 }}
          >
            Automatic
          </p>
          {renderRows(automatic, cardColor, cb)}
        </div>
      )}

      {hidden.length > 0 && <HiddenBenefits hidden={hidden} cardColor={cardColor} cb={cb} />}
    </div>
  );
}
