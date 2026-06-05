"use client";

import { COLORS, RADII, TYPE } from "@/lib/ui/tokens";
import { ManagedRow, type ManagedCard } from "./managed-row";
import { PlusIcon } from "./icons";

export type { ManagedCard };

/** Props for AdminHome. */
export interface AdminHomeProps {
  cards: ManagedCard[];
  onAdd: () => void;
  onRescrape: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  /** The userCardId currently mid re-scrape, or null. */
  busyId: string | null;
  loading?: boolean;
  error?: string | null;
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div
        style={{
          ...TYPE.stat,
          color: COLORS.text,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: COLORS.text3, marginTop: 5, letterSpacing: 0.3 }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Admin home view (design source `AdminHome`): top bar, summary strip computed
 * from real data, the primary "Add a card" action with review-gate subcopy, and
 * the "Your cards" managed-card list.
 */
export function AdminHome({
  cards,
  onAdd,
  onRescrape,
  onRemove,
  busyId,
  loading,
  error,
}: AdminHomeProps) {
  const totalBenefits = cards.reduce((sum, c) => sum + c.benefitCount, 0);
  const issuerCount = new Set(cards.map((c) => c.card.issuer)).size;

  return (
    <div style={{ minHeight: "100dvh", background: COLORS.bg }}>
      {/* Top bar */}
      <div style={{ padding: "16px 18px 14px" }}>
        <div style={{ fontSize: 11, color: COLORS.text3, letterSpacing: 0.4, marginBottom: 2 }}>
          Cards &amp; benefits
        </div>
        <div style={{ ...TYPE.title, color: COLORS.text }}>Admin</div>
      </div>

      {/* Summary strip */}
      <div style={{ padding: "0 16px 18px" }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: RADII.card,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 22 }}>
            <SummaryStat value={cards.length} label="cards" />
            <div style={{ width: 1, background: COLORS.hairline }} />
            <SummaryStat value={totalBenefits} label="benefits tracked" />
            <div style={{ width: 1, background: COLORS.hairline }} />
            <SummaryStat value={issuerCount} label="issuers" />
          </div>
        </div>
      </div>

      {/* Add a card */}
      <div style={{ padding: "0 16px 22px" }}>
        <button
          onClick={onAdd}
          className="transition-opacity hover:opacity-90"
          style={{
            width: "100%",
            padding: "15px 16px",
            borderRadius: RADII.button + 1,
            cursor: "pointer",
            background: COLORS.amberSoft,
            border: "1px solid rgba(245,158,11,0.28)",
            color: COLORS.amber,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            fontSize: 14.5,
            fontWeight: 600,
            letterSpacing: -0.1,
          }}
        >
          {PlusIcon} Add a card
        </button>
        <div
          style={{
            fontSize: 11,
            color: COLORS.text4,
            textAlign: "center",
            marginTop: 9,
            letterSpacing: 0.1,
          }}
        >
          We&apos;ll scan its benefits automatically — you confirm before anything&apos;s saved.
        </div>
      </div>

      {/* Section header */}
      <div
        style={{
          padding: "0 20px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            ...TYPE.label,
            color: COLORS.text3,
            textTransform: "uppercase",
          }}
        >
          Your cards
        </div>
        <div style={{ fontSize: 11, color: COLORS.text3 }}>{cards.length}</div>
      </div>

      {loading && (
        <p style={{ padding: "0 18px 24px", fontSize: 13, color: COLORS.text3 }}>Loading cards…</p>
      )}
      {error && (
        <p style={{ padding: "0 18px 12px", fontSize: 13, color: COLORS.amber }} role="alert">
          {error}
        </p>
      )}

      {!loading && cards.length === 0 && (
        <p style={{ padding: "0 18px 32px", fontSize: 13, color: COLORS.text3 }}>
          No cards yet — add your first card.
        </p>
      )}

      <div
        style={{
          padding: "0 16px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {cards.map((c) => (
          <ManagedRow
            key={c.id}
            card={c}
            busy={busyId === c.id}
            onRescrape={onRescrape}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
