"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLORS, EASING, RADII } from "@/lib/ui/tokens";
import type { CatalogCard } from "@/types/card";
import { FlowShell } from "./flow-shell";
import { MiniCard } from "./mini-card";
import { ChevronRight, PlusIcon, SearchIcon } from "./icons";

/** Props for AddPicker. */
export interface AddPickerProps {
  onClose: () => void;
  /** Called with the new userCardId after a successful POST /api/user-cards. */
  onAdded: (userCardId: string) => void;
}

const inputBase = {
  flex: 1,
  background: "transparent",
  border: 0,
  outline: "none",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "inherit",
  letterSpacing: -0.1,
} as const;

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: COLORS.surface,
  border: `1px solid ${COLORS.hairline2}`,
  borderRadius: RADII.control,
  padding: "11px 14px",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  letterSpacing: -0.1,
};

/**
 * Full-screen add-card picker (design source `AddPicker`): search box + catalog
 * list from GET /api/catalog. Picking a card POSTs /api/user-cards then hands the
 * new userCardId to the parent to start the scrape. Preserves the custom-card add
 * path via a "+ Add a custom card" affordance, and surfaces duplicate-409 inline.
 */
export function AddPicker({ onClose, onAdded }: AddPickerProps) {
  const reduceMotion = useReducedMotion();
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  // Custom-card sub-flow.
  const [customOpen, setCustomOpen] = useState(false);
  const [customIssuer, setCustomIssuer] = useState("");
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/catalog")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load catalog");
        return res.json();
      })
      .then((data: CatalogCard[]) => setCatalog(data))
      .catch(() => setError("Could not load card catalog"))
      .finally(() => setLoading(false));
  }, []);

  const list = catalog.filter((c) =>
    `${c.issuer} ${c.name}`.toLowerCase().includes(query.toLowerCase()),
  );

  const addCatalogCard = useCallback(
    async (catalogCardId: string) => {
      setAddingId(catalogCardId);
      setDuplicateId(null);
      setError(null);
      try {
        const res = await fetch("/api/user-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogCardId }),
        });
        if (res.status === 409) {
          setDuplicateId(catalogCardId);
          return;
        }
        if (!res.ok) throw new Error("Failed to add card");
        const data = await res.json();
        onAdded(data.id);
      } catch {
        setError("Failed to add card");
      } finally {
        setAddingId(null);
      }
    },
    [onAdded],
  );

  const addCustomCard = useCallback(async () => {
    setAddingCustom(true);
    setError(null);
    try {
      const res = await fetch("/api/user-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customIssuer: customIssuer.trim(), customName: customName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add card");
      const data = await res.json();
      onAdded(data.id);
    } catch {
      setError("Failed to add custom card");
    } finally {
      setAddingCustom(false);
    }
  }, [customIssuer, customName, onAdded]);

  const isAdding = addingId !== null || addingCustom;

  return (
    <FlowShell title="Add a card" subtitle="Pick the card you want to track" onClose={onClose}>
      {/* search */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "11px 14px",
            borderRadius: RADII.control,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline2}`,
          }}
        >
          <span style={{ color: COLORS.text3, display: "inline-flex", flexShrink: 0 }}>
            {SearchIcon}
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issuers and cards"
            aria-label="Search issuers and cards"
            style={inputBase}
          />
        </div>
      </div>

      {loading && (
        <p style={{ padding: "0 18px 16px", fontSize: 13, color: COLORS.text3 }}>
          Loading catalog…
        </p>
      )}
      {error && (
        <p style={{ padding: "0 18px 12px", fontSize: 13, color: COLORS.amber }} role="alert">
          {error}
        </p>
      )}

      {!loading && (
        <>
          <div
            style={{
              padding: "0 20px 8px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 1.1,
              color: COLORS.text3,
              textTransform: "uppercase",
            }}
          >
            Cards
          </div>
          <div
            style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 9 }}
          >
            {list.map((c) => (
              <motion.button
                key={c.id}
                onClick={() => addCatalogCard(c.id)}
                disabled={isAdding}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASING }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "12px 14px",
                  borderRadius: RADII.button,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.hairline}`,
                  cursor: isAdding ? "default" : "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  width: "100%",
                }}
              >
                <MiniCard color={c.defaultColor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: COLORS.text,
                      letterSpacing: -0.2,
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: COLORS.text3, marginTop: 3 }}>
                    {c.issuer}
                  </div>
                </div>
                {addingId === c.id ? (
                  <span style={{ fontSize: 11.5, color: COLORS.amber, flexShrink: 0 }}>Adding…</span>
                ) : duplicateId === c.id ? (
                  <span style={{ fontSize: 11, color: COLORS.amber, flexShrink: 0 }}>
                    Already added
                  </span>
                ) : (
                  <span style={{ color: COLORS.text4, display: "inline-flex", flexShrink: 0 }}>
                    {ChevronRight}
                  </span>
                )}
              </motion.button>
            ))}
            {list.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0", color: COLORS.text4, fontSize: 13 }}>
                No matches for &ldquo;{query}&rdquo;.
              </div>
            )}
          </div>

          {/* custom-card affordance (preserves the custom add path) */}
          <div style={{ padding: "0 16px 28px" }}>
            {!customOpen ? (
              <button
                onClick={() => setCustomOpen(true)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: RADII.button,
                  cursor: "pointer",
                  background: "transparent",
                  border: `1px dashed ${COLORS.hairline2}`,
                  color: COLORS.text2,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {PlusIcon} Add a custom card
              </button>
            ) : (
              <div
                style={{
                  padding: "14px",
                  borderRadius: RADII.button,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.hairline}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Custom card</div>
                <input
                  placeholder="Issuer (e.g. US Bank)"
                  aria-label="Custom issuer"
                  value={customIssuer}
                  onChange={(e) => setCustomIssuer(e.target.value)}
                  style={fieldStyle}
                />
                <input
                  placeholder="Card name"
                  aria-label="Custom card name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={fieldStyle}
                />
                <button
                  onClick={addCustomCard}
                  disabled={!customIssuer.trim() || !customName.trim() || isAdding}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: RADII.button,
                    cursor:
                      !customIssuer.trim() || !customName.trim() || isAdding
                        ? "not-allowed"
                        : "pointer",
                    background:
                      !customIssuer.trim() || !customName.trim() ? "rgba(255,255,255,0.06)" : COLORS.amber,
                    border: "none",
                    color:
                      !customIssuer.trim() || !customName.trim() ? COLORS.text4 : "#1A1208",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                >
                  {addingCustom ? "Adding…" : "Add custom card"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </FlowShell>
  );
}
