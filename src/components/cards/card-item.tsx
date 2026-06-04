"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { UserCardWithCard } from "@/types/card";
import type { BenefitWithPeriod } from "@/types/benefit";
import { COLORS, RADII, SHADOWS } from "@/lib/ui/tokens";
import { humanizeIssuer } from "@/components/overview/format";
import { cardGradient } from "./card-gradient";

export interface CardItemProps {
  userCard: UserCardWithCard;
  benefits: BenefitWithPeriod[];
  isExpanded: boolean;
  onTap: () => void;
}

const EXPIRING_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function isBenefitExpiringSoon(benefit: BenefitWithPeriod): boolean {
  const end = benefit.currentPeriod?.periodEnd;
  if (!end) return false;
  const daysLeft = (new Date(end).getTime() - Date.now()) / MS_PER_DAY;
  return daysLeft >= 0 && daysLeft <= EXPIRING_DAYS;
}

/** Gold EMV chip glyph — ported from the design source. */
function ChipGlyph() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
      <rect x="0" y="0" width="28" height="22" rx="3.5" fill="#D4B45E" />
      <rect x="0" y="0" width="28" height="22" rx="3.5" fill="url(#cm-chip-shade)" opacity="0.5" />
      <g stroke="rgba(0,0,0,0.25)" strokeWidth="0.7" fill="none">
        <path d="M0 7h7M0 15h7M21 7h7M21 15h7M9 0v6M19 0v6M9 16v6M19 16v6" />
        <rect x="7" y="5" width="14" height="12" rx="1.5" fill="rgba(0,0,0,0.05)" />
      </g>
      <defs>
        <linearGradient id="cm-chip-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.3)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * A single credit-card face. The `motion.div` shared-layout morph
 * (`layoutId`), `whileTap`, `aspectRatio`, and `onClick` are the Apple-Wallet
 * stack animation mechanics and are intentionally preserved (Task 64 hard
 * constraint). Only the VISUAL layer inside is restyled to the design tokens:
 * the design's depth gradient, shine + grain overlays, chip glyph, issuer/name
 * lines and benefit count. Last4, network logo, and opened date are omitted.
 */
export function CardItem({ userCard, benefits, onTap }: CardItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasExpiring = benefits.some(isBenefitExpiringSoon);
  const issuer = userCard.card.issuer;
  const gradient = cardGradient(userCard.card.defaultColor);

  return (
    <motion.div
      layoutId={userCard.id}
      className="relative w-full cursor-pointer overflow-hidden"
      style={{
        aspectRatio: "85.6 / 53.98",
        borderRadius: RADII.cardLg,
        background: gradient,
        boxShadow: SHADOWS.card,
        color: "#fff",
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={onTap}
      aria-label={`${issuer} ${userCard.card.name}`}
    >
      {/* Subtle shine */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(140% 90% at -10% -10%, rgba(255,255,255,0.18) 0%, transparent 50%)",
        }}
      />
      {/* Fine grain texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 5px)",
          mixBlendMode: "overlay",
        }}
      />

      {/* Card content */}
      <div className="relative flex h-full flex-col justify-between p-5">
        {/* Top: issuer + product name */}
        <div>
          <p
            className="font-semibold leading-tight text-white"
            style={{ fontSize: 19, letterSpacing: -0.3 }}
          >
            {humanizeIssuer(issuer)}
          </p>
          <p
            className="mt-1 font-medium"
            style={{ fontSize: 13, letterSpacing: -0.1, color: "rgba(255,255,255,0.82)" }}
          >
            {userCard.card.name}
          </p>
        </div>

        {/* Middle: chip */}
        <div className="flex items-center">
          <ChipGlyph />
        </div>

        {/* Bottom: benefit count (no last4 / no network / no opened date) */}
        <div className="flex items-end justify-end">
          {benefits.length > 0 && (
            <p
              className="font-medium"
              style={{ fontSize: 10, letterSpacing: 0.3, color: "rgba(255,255,255,0.65)" }}
            >
              {benefits.length} benefit{benefits.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Expiring alert */}
      {hasExpiring && (
        <motion.div
          className="absolute right-4 top-4"
          animate={prefersReducedMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Benefits expiring soon"
        >
          <AlertTriangle size={18} color={COLORS.amber} />
        </motion.div>
      )}
    </motion.div>
  );
}
