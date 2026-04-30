"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { UserCardWithCard } from "@/types/card";
import type { BenefitWithPeriod } from "@/types/benefit";

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

/** Per-card unique gradient so every card looks distinct. */
const CARD_GRADIENTS: Record<string, string> = {
  // Chase
  "chase-sapphire-reserve": "linear-gradient(135deg, #0a1428 0%, #0c2450 30%, #1a4db8 70%, #2563eb 100%)",
  "chase-sapphire-preferred": "linear-gradient(150deg, #0c1a36 0%, #14306b 40%, #1e5cc7 80%, #60a5fa 100%)",
  "chase-freedom-unlimited": "linear-gradient(140deg, #0f1f3d 0%, #1a3d75 35%, #2563eb 75%, #93c5fd 100%)",
  "chase-freedom-flex": "linear-gradient(130deg, #0d1a30 0%, #1a3a6b 40%, #3b82f6 100%)",
  "chase-amazon-prime-visa": "linear-gradient(145deg, #1a1a2e 0%, #0f2847 35%, #1a4480 70%, #2d6bcf 100%)",
  // Amex
  "amex-platinum": "linear-gradient(140deg, #2a2a2a 0%, #4a4a4a 30%, #6b6b6b 60%, #8a8a8a 100%)",
  "amex-gold": "linear-gradient(135deg, #5c4a1a 0%, #8B7325 30%, #B8952A 60%, #D4AF37 100%)",
  "amex-blue-cash-preferred": "linear-gradient(145deg, #0a1e3d 0%, #1a3d7a 35%, #2563eb 70%, #60a5fa 100%)",
  "amex-blue-cash-everyday": "linear-gradient(150deg, #0f2847 0%, #1e4d8c 40%, #3b82f6 75%, #93c5fd 100%)",
  // Capital One
  "capital-one-venture-x": "linear-gradient(135deg, #1a0a0a 0%, #4a1212 30%, #7f1d1d 65%, #991b1b 100%)",
  "capital-one-venture": "linear-gradient(140deg, #2d0e0e 0%, #6b1a1a 40%, #9b1c1c 75%, #b91c1c 100%)",
  "capital-one-quicksilver": "linear-gradient(145deg, #1a1a1a 0%, #3d3d3d 35%, #6b6b6b 70%, #8a8a8a 100%)",
  "capital-one-savor-one": "linear-gradient(135deg, #1a0f05 0%, #5c2d0a 35%, #9a3412 70%, #c2410c 100%)",
  // Citi
  "citi-strata-premier": "linear-gradient(135deg, #0a1040 0%, #1a2d6b 35%, #1e40af 65%, #3b82f6 100%)",
  "citi-double-cash": "linear-gradient(150deg, #1a1a2e 0%, #2d2d5e 40%, #4338ca 100%)",
  "citi-diamond-preferred": "linear-gradient(140deg, #0f1629 0%, #1e2a52 35%, #3b4f8a 70%, #6366f1 100%)",
  // Discover
  "discover-it-cash-back": "linear-gradient(135deg, #3d1808 0%, #7c2d12 30%, #c2410c 65%, #ea580c 100%)",
  // Wells Fargo
  "wells-fargo-active-cash": "linear-gradient(140deg, #2d1a08 0%, #5c3d0e 35%, #854d0e 65%, #a16207 100%)",
};

/** Fallback gradients per issuer for cards not in the map. */
const ISSUER_GRADIENTS: Record<string, string> = {
  "Chase": "linear-gradient(135deg, #0a1e3d 0%, #132f5e 30%, #1a56db 70%, #2563eb 100%)",
  "Amex": "linear-gradient(135deg, #5c4a1a 0%, #8B7325 30%, #B8952A 60%, #D4AF37 100%)",
  "Capital One": "linear-gradient(135deg, #3d0a0a 0%, #6b1a1a 30%, #9b1c1c 70%, #b91c1c 100%)",
  "Citi": "linear-gradient(135deg, #0a1a4d 0%, #142d6b 30%, #1e40af 70%, #3b82f6 100%)",
  "Discover": "linear-gradient(135deg, #5c2208 0%, #9a3412 30%, #c2410c 70%, #ea580c 100%)",
  "Wells Fargo": "linear-gradient(135deg, #3d2a08 0%, #5c3d0e 30%, #854d0e 70%, #a16207 100%)",
  "Other": "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 30%, #404040 70%, #525252 100%)",
};

const ISSUER_NETWORKS: Record<string, string> = {
  "Chase": "VISA",
  "Amex": "AMEX",
  "Capital One": "VISA",
  "Citi": "MASTERCARD",
  "Discover": "DISCOVER",
  "Wells Fargo": "VISA",
  "Other": "",
};

function CardChip() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
      <rect x="0.5" y="0.5" width="35" height="27" rx="4" fill="#C9B037" stroke="#A08C2A" strokeWidth="1" />
      <line x1="0" y1="10" x2="36" y2="10" stroke="#A08C2A" strokeWidth="0.5" />
      <line x1="0" y1="18" x2="36" y2="18" stroke="#A08C2A" strokeWidth="0.5" />
      <line x1="12" y1="0" x2="12" y2="28" stroke="#A08C2A" strokeWidth="0.5" />
      <line x1="24" y1="0" x2="24" y2="28" stroke="#A08C2A" strokeWidth="0.5" />
    </svg>
  );
}

export function CardItem({ userCard, benefits, onTap }: CardItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasExpiring = benefits.some(isBenefitExpiringSoon);
  const issuer = userCard.card.issuer;
  const cardId = userCard.card.id;
  const gradient = CARD_GRADIENTS[cardId] ?? ISSUER_GRADIENTS[issuer] ?? ISSUER_GRADIENTS["Other"];
  const network = ISSUER_NETWORKS[issuer] ?? "";

  // Try loading a card image from /cards/{card-id}.png
  const [hasImage, setHasImage] = useState(true);
  const imageUrl = `/cards/${cardId}.png`;

  return (
    <motion.div
      layoutId={userCard.id}
      className="rounded-2xl w-full cursor-pointer relative overflow-hidden"
      style={{
        aspectRatio: "85.6 / 53.98",
        background: gradient,
        boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)",
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={onTap}
      aria-label={`${issuer} ${userCard.card.name}`}
    >
      {/* Actual card image as faint background */}
      {hasImage && (
        <img
          src={imageUrl}
          alt=""
          onError={() => setHasImage(false)}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: 0.25 }}
          draggable={false}
        />
      )}

      {/* Subtle lighting overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.12) 100%)",
        }}
      />

      {/* Card content */}
      <div className="relative p-5 flex flex-col h-full justify-between">
        {/* Top: issuer + network */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-lg font-bold text-white tracking-wide drop-shadow-sm">{issuer}</p>
            <p className="text-sm font-medium text-white/70 mt-0.5 drop-shadow-sm">{userCard.card.name}</p>
          </div>
          {network && (
            <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] mt-1">
              {network}
            </span>
          )}
        </div>

        {/* Middle: chip */}
        <div className="flex items-center">
          <CardChip />
        </div>

        {/* Bottom: dots + benefit count */}
        <div className="flex justify-between items-end">
          <p className="text-xs text-white/30 tracking-[0.25em] font-mono">
            •••• •••• •••• ••••
          </p>
          {benefits.length > 0 && (
            <p className="text-xs text-white/40">
              {benefits.length} benefit{benefits.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Expiring alert */}
      {hasExpiring && (
        <motion.div
          className="absolute top-4 right-4"
          animate={prefersReducedMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Benefits expiring soon"
        >
          <AlertTriangle size={18} color="#F59E0B" />
        </motion.div>
      )}
    </motion.div>
  );
}
