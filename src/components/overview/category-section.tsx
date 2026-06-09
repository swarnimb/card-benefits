"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { CategoryGroup } from "@/types/api";
import { OV, OV_SPRING } from "./tokens";
import { usd, categoryGlyph } from "./format";
import { Progress } from "./progress";
import { SectionHeader } from "./section-header";
import { CategoryDetailRow } from "./category-detail-row";
import { Chevron } from "./chevron";

interface CategorySectionProps {
  /** activeByCategory[] — grouped + sorted by the engine; empty groups omitted. */
  groups: CategoryGroup[];
  /** Logs usage for a benefit (optimistic). Wired from useOverviewData (Task 70/71). */
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
}

/**
 * "Active credits" by category — collapsible category cards. First group open by
 * default. Renders nothing when empty. Ports the design source
 * `CategoriesSection` / `CategoryRow` / `CategoryDetailRow`.
 */
export function CategorySection({ groups, onUsageUpdate }: CategorySectionProps) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(groups[0] ? [groups[0].group] : []),
  );
  // One detail row expanded at a time across the whole section (Task 71).
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const toggle = (group: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const toggleRow = (benefitId: string) =>
    setExpandedRowId((prev) => (prev === benefitId ? null : benefitId));

  const totalCredits = groups.reduce((s, g) => s + g.creditCount, 0);

  return (
    <section className="px-4 pt-5 pb-1.5">
      <SectionHeader label="Active credits" right={<span>{totalCredits} total</span>} />
      <div className="flex flex-col gap-2">
        {groups.map((g, i) => (
          <CategoryRow
            key={g.group}
            group={g}
            open={open.has(g.group)}
            onToggle={() => toggle(g.group)}
            i={i}
            expandedRowId={expandedRowId}
            onRowToggle={toggleRow}
            onUsageUpdate={onUsageUpdate}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryRow({
  group,
  open,
  onToggle,
  i,
  expandedRowId,
  onRowToggle,
  onUsageUpdate,
}: {
  group: CategoryGroup;
  open: boolean;
  onToggle: () => void;
  i: number;
  expandedRowId: string | null;
  onRowToggle: (benefitId: string) => void;
  onUsageUpdate: (benefitId: string, newAmount: number) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="overflow-hidden rounded-2xl"
      style={{ background: OV.surface, border: `1px solid ${OV.hairline}` }}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.05 + i * 0.05 }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="block w-full cursor-pointer text-left"
        style={{ background: "transparent", border: 0, color: "inherit", padding: "14px 16px", font: "inherit" }}
      >
        <div className="mb-2.5 flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-[7px]"
            style={{ width: 22, height: 22, background: "rgba(255,255,255,0.05)", color: OV.text2 }}
          >
            {categoryGlyph(group.group)}
          </div>
          <div
            className="flex-1 text-[14.5px] font-medium"
            style={{ color: OV.text, letterSpacing: "-0.15px" }}
          >
            {group.group}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-base font-semibold tabular-nums"
              style={{ color: OV.text, letterSpacing: "-0.3px" }}
            >
              {usd(group.totalRemaining)}
            </span>
            <span className="text-[11px]" style={{ color: OV.text3 }}>
              left
            </span>
          </div>
          <motion.span
            aria-hidden
            className="ml-1 inline-flex"
            style={{ color: OV.text3 }}
            animate={reduceMotion ? undefined : { rotate: open ? 180 : 0 }}
            transition={OV_SPRING}
          >
            <Chevron size={11} />
          </motion.span>
        </div>

        <Progress
          used={group.totalUsed}
          amt={group.totalValue}
          color={OV.green}
          track={OV.greenTrack}
          height={2.5}
        />

        <div
          className="mt-2 flex justify-between text-[10.5px] tabular-nums"
          style={{ color: OV.text3 }}
        >
          <span>
            {usd(group.totalUsed)} redeemed of {usd(group.totalValue)}
          </span>
          <span>
            {group.creditCount} credits · {group.cardCount} cards
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            className="overflow-hidden"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : OV_SPRING}
          >
            <div
              style={{ borderTop: `1px solid ${OV.hairline}`, padding: "6px 16px 14px" }}
            >
              {group.credits.map((c, idx) => (
                <CategoryDetailRow
                  key={c.benefitId}
                  c={c}
                  last={idx === group.credits.length - 1}
                  expanded={expandedRowId === c.benefitId}
                  onToggle={() => onRowToggle(c.benefitId)}
                  onUsageUpdate={onUsageUpdate}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
