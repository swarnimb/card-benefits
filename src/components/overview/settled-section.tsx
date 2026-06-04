"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { OverviewBenefit } from "@/types/api";
import { OV, OV_SPRING } from "./tokens";
import { usd, humanizeIssuer } from "./format";
import { IssuerDot } from "./issuer-dot";

interface SettledSectionProps {
  /** done[] — fully-used + nothing-to-do benefits, collapsed by default. */
  done: OverviewBenefit[];
}

/**
 * "Settled" — de-emphasized, collapsed-by-default section for done benefits.
 * Split by dollar value (decided): `value !== null` → "Fully used" (shows the
 * dollar amount with a green check); `value === null` → "Nothing to do" (shows
 * "—"). Renders nothing when empty. Ports the design source `DormantSection`.
 */
export function SettledSection({ done }: SettledSectionProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  if (done.length === 0) return null;

  const fullyUsed = done.filter((c) => c.value !== null);
  const nothingToDo = done.filter((c) => c.value === null);

  return (
    <section className="px-4 pt-5 pb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] text-left"
        style={{
          background: "transparent",
          border: `1px dashed ${OV.hairline2}`,
          padding: "12px 14px",
          color: OV.text3,
          font: "inherit",
        }}
      >
        <div className="flex flex-1 items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3.5 6l3 3 6-6"
              stroke={OV.green}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[12.5px] font-medium" style={{ color: OV.text2 }}>
            Settled
          </span>
          <span className="text-[11px]" style={{ color: OV.text4 }}>
            · {fullyUsed.length} used, {nothingToDo.length} nothing to do
          </span>
        </div>
        <motion.span
          aria-hidden
          className="inline-flex"
          style={{ color: OV.text3 }}
          animate={reduceMotion ? undefined : { rotate: open ? 180 : 0 }}
          transition={OV_SPRING}
        >
          <Chevron />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="settled-body"
            className="overflow-hidden"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : OV_SPRING}
          >
            <div style={{ padding: "10px 4px 0" }}>
              {fullyUsed.length > 0 && (
                <SettledList label="Fully used" items={fullyUsed} kind="used" />
              )}
              {nothingToDo.length > 0 && (
                <SettledList label="Nothing to do" items={nothingToDo} kind="dormant" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SettledList({
  label,
  items,
  kind,
}: {
  label: string;
  items: OverviewBenefit[];
  kind: "used" | "dormant";
}) {
  return (
    <div className="mt-2.5">
      <div
        className="mb-2 pl-1 text-[10px] font-medium uppercase"
        style={{ letterSpacing: "1px", color: OV.text4 }}
      >
        {label}
      </div>
      <div className="flex flex-col">
        {items.map((c, i) => (
          <div
            key={c.benefitId}
            className="flex items-center gap-2.5"
            style={{
              padding: "10px 4px",
              borderBottom: i === items.length - 1 ? "none" : `1px solid ${OV.hairline}`,
            }}
          >
            <IssuerDot color={c.cardColor} size={5} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px]" style={{ color: OV.text2 }}>
                {c.benefitName}
              </div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: OV.text4 }}>
                {humanizeIssuer(c.issuer)} · {c.resetPeriod}
              </div>
            </div>
            {kind === "used" ? (
              <div
                className="inline-flex items-center gap-1.5 rounded-full text-[10px] font-medium"
                style={{
                  padding: "3px 7px",
                  background: OV.greenDim,
                  color: OV.green,
                  letterSpacing: "0.2px",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2 6l3 3 5-7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                {usd(c.value ?? 0)}
              </div>
            ) : (
              <div className="text-[10.5px]" style={{ color: OV.text4, letterSpacing: "0.2px" }}>
                —
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
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
