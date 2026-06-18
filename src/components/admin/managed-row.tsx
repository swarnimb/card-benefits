"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING_ARRAY, RADII } from "@/lib/ui/tokens";
import { MiniCard } from "./mini-card";
import { DeleteConfirm } from "./delete-confirm";
import { ManagedBenefitsPanel } from "./managed-benefits-panel";
import { RescrapeIcon, TrashIcon, ChevronDown } from "./icons";
import { IconButton } from "./icon-button";

/** Shape of a card row in the management list. */
export interface ManagedCard {
  id: string;
  card: { issuer: string; name: string; defaultColor: string };
  lastVerifiedAt: string | null;
  benefitCount: number;
}

/** Props for ManagedRow. */
export interface ManagedRowProps {
  card: ManagedCard;
  onRescrape: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  /** True while this card is mid re-scrape — swaps actions for a "Checking…" state. */
  busy?: boolean;
}

/** Relative "last checked" label. */
export function relativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/**
 * A single managed-card row (design source `ManagedRow`): MiniCard + product +
 * issuer · benefit count, last-checked footer, and per-row re-scan + delete with
 * an inline expand delete-confirm. Delete is wired to the parent (which DELETEs
 * the userCard); re-scan triggers the parent scrape → review flow.
 */
export function ManagedRow({ card, onRescrape, onRemove, busy }: ManagedRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const { issuer, name, defaultColor } = card.card;
  const count = card.benefitCount;
  const checked = relativeDate(card.lastVerifiedAt);

  return (
    <div
      data-testid="card-row"
      style={{
        borderRadius: RADII.card,
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px" }}>
        <MiniCard color={defaultColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 500,
              color: COLORS.text,
              letterSpacing: -0.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: COLORS.text3,
              marginTop: 3,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{issuer}</span>
            <span style={{ color: COLORS.text4 }}>·</span>
            <span>
              {count} benefit{count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {!busy ? (
          <div style={{ display: "flex", gap: 7 }}>
            <IconButton
              label={`${expanded ? "Collapse" : "Expand"} benefits for ${name}`}
              onClick={() => setExpanded((e) => !e)}
            >
              <motion.span
                style={{ display: "inline-flex" }}
                animate={reduceMotion ? undefined : { rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: EASING_ARRAY }}
              >
                {ChevronDown}
              </motion.span>
            </IconButton>
            <IconButton label={`Refresh benefits for ${name}`} onClick={() => onRescrape(card.id)}>
              {RescrapeIcon}
            </IconButton>
            <IconButton label={`Remove ${name}`} onClick={() => setConfirming(true)}>
              {TrashIcon}
            </IconButton>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              color: COLORS.amber,
              fontSize: 11.5,
              fontWeight: 500,
            }}
          >
            <motion.span
              style={{ display: "inline-flex" }}
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            >
              {RescrapeIcon}
            </motion.span>
            Checking…
          </div>
        )}
      </div>

      {/* expandable inline benefit list (Task 83) */}
      <ManagedBenefitsPanel userCardId={card.id} open={expanded} />

      {/* last-checked footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderTop: `1px solid ${COLORS.hairline}`,
          fontSize: 11,
          color: COLORS.text3,
          background: "rgba(255,255,255,0.012)",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: RADII.pill,
            background: checked === "Today" ? COLORS.green : COLORS.text4,
          }}
        />
        <span>Benefits last checked</span>
        <span style={{ color: COLORS.text2, marginLeft: "auto", fontWeight: 500 }}>{checked}</span>
      </div>

      {/* inline delete confirm */}
      <DeleteConfirm
        open={confirming}
        issuer={issuer}
        name={name}
        count={count}
        onKeep={() => setConfirming(false)}
        onRemove={() => {
          setConfirming(false);
          onRemove(card.id);
        }}
      />
    </div>
  );
}
