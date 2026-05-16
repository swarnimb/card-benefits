"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { OverviewBenefit } from "@/types/api";
import { OV, OV_SPRING } from "./tokens";
import { OverviewBenefitRow } from "./overview-benefit-row";

type Tone = "attention" | "track" | "settled";

interface UrgencySectionProps {
  title: string;
  tone: Tone;
  benefits?: OverviewBenefit[];
  defaultCollapsed?: boolean;
  children?: ReactNode;
}

const TONE_ACCENT: Record<Tone, string> = {
  attention: OV.amber,
  track: OV.green,
  settled: OV.text3,
};

/**
 * One urgency-keyed Overview section. Renders nothing when it has neither
 * benefits nor children (so an empty "Needs attention" disappears entirely).
 * When `defaultCollapsed` is set it renders the de-emphasized collapsed
 * "Done" treatment with a Framer Motion spring expand. `children` (e.g. the
 * On-track category accordions) takes precedence over the flat benefit list.
 */
export function UrgencySection({
  title,
  tone,
  benefits = [],
  defaultCollapsed = false,
  children,
}: UrgencySectionProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(!defaultCollapsed);

  const hasContent = children != null || benefits.length > 0;
  if (!hasContent) return null;

  const accent = TONE_ACCENT[tone];
  const count = children != null ? null : benefits.length;

  const body = (
    <div className="flex flex-col gap-2.5">
      {children ??
        benefits.map((b) => <OverviewBenefitRow key={b.benefitId} benefit={b} />)}
    </div>
  );

  if (!defaultCollapsed) {
    return (
      <section className="px-4 pt-2 pb-1.5">
        <div className="flex items-center justify-between px-1 pb-3">
          <span
            className="text-[11px] font-medium uppercase"
            style={{ letterSpacing: "1.1px", color: OV.text3 }}
          >
            {title}
          </span>
          {count !== null && (
            <span className="text-[11px] font-medium" style={{ color: accent }}>
              {count}
            </span>
          )}
        </div>
        {body}
      </section>
    );
  }

  return (
    <section className="px-4 pt-5 pb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
        style={{ border: `1px dashed ${OV.hairline2}`, color: OV.text3 }}
      >
        <span className="flex-1 text-[12.5px] font-medium" style={{ color: OV.text2 }}>
          {title}
        </span>
        {count !== null && (
          <span className="text-[11px]" style={{ color: OV.text4 }}>
            {count}
          </span>
        )}
        <motion.span
          aria-hidden
          animate={reduceMotion ? undefined : { rotate: open ? 180 : 0 }}
          transition={OV_SPRING}
          className="inline-flex"
          style={{ color: OV.text3 }}
        >
          <Chevron />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="settled-body"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={OV_SPRING}
            className="overflow-hidden"
          >
            <div className="pt-2.5">{body}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
