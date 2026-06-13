"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING_ARRAY, RADII } from "@/lib/ui/tokens";
import { ManagedBenefitRow } from "./managed-benefit-row";
import { AddBenefitForm } from "./add-benefit-form";
import { PlusIcon } from "./icons";
import { useCardBenefits } from "@/hooks/use-card-benefits";
import { useBenefitMutations } from "@/hooks/use-benefit-mutations";

/** Props for ManagedBenefitsPanel — the expand region of a managed card row. */
export interface ManagedBenefitsPanelProps {
  userCardId: string;
  open: boolean;
}

/**
 * The animated expand region listing a card's benefits + an "Add benefit"
 * affordance (Task 83/84/85). LAZY: `useCardBenefits` only fetches once `open`.
 * Surfaces loading, empty, and fetch-error (amber, role="alert") states — never
 * a silently-empty list (EH-01). Add/Edit/Delete all refetch on success.
 */
export function ManagedBenefitsPanel({ userCardId, open }: ManagedBenefitsPanelProps) {
  const reduceMotion = useReducedMotion();
  const [adding, setAdding] = useState(false);
  const { benefits, loading, error, refetch } = useCardBenefits(userCardId, open);
  const { editBenefit, deleteBenefit } = useBenefitMutations(refetch);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { height: 0, opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASING_ARRAY }}
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              padding: "10px 14px 14px",
              borderTop: `1px solid ${COLORS.hairline}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {loading && (
              <p style={{ fontSize: 12, color: COLORS.text3, margin: "4px 0" }}>Loading benefits…</p>
            )}

            {error && (
              <p
                role="alert"
                style={{ fontSize: 12, color: COLORS.amber, margin: "4px 0", lineHeight: 1.4 }}
              >
                {error}
              </p>
            )}

            {!loading && !error && benefits.length === 0 && (
              <p style={{ fontSize: 12, color: COLORS.text3, margin: "4px 0" }}>No benefits yet</p>
            )}

            {!error &&
              benefits.map((b) => (
                <ManagedBenefitRow
                  key={b.id}
                  benefit={b}
                  onEdit={editBenefit}
                  onDelete={deleteBenefit}
                />
              ))}

            {adding ? (
              <AddBenefitForm
                userCardId={userCardId}
                onCreated={() => {
                  setAdding(false);
                  refetch();
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{
                  marginTop: 2,
                  padding: "10px",
                  borderRadius: RADII.input + 1,
                  cursor: "pointer",
                  background: "transparent",
                  border: `1px dashed ${COLORS.hairline2}`,
                  color: COLORS.text2,
                  fontSize: 12.5,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                {PlusIcon} Add benefit
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
