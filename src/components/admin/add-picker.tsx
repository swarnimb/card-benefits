"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/demo/demo-api";
import { COLORS } from "@/lib/ui/tokens";
import type { CatalogCard } from "@/types/card";
import { FlowShell } from "./flow-shell";
import { CatalogRow } from "./catalog-row";
import { CustomCardForm } from "./custom-card-form";
import { PickerSearch } from "./picker-search";

/** Props for AddPicker. */
export interface AddPickerProps {
  onClose: () => void;
  /** Called with the new userCardId after a successful POST /api/user-cards. */
  onAdded: (userCardId: string) => void;
}

/**
 * Full-screen add-card picker (design source `AddPicker`): search box + catalog
 * list from GET /api/catalog. Picking a card POSTs /api/user-cards then hands the
 * new userCardId to the parent to start the scrape. Preserves the custom-card add
 * path via a "+ Add a custom card" affordance, and surfaces duplicate-409 inline.
 */
export function AddPicker({ onClose, onAdded }: AddPickerProps) {
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
    apiFetch("/api/catalog")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load catalog");
        return res.json();
      })
      .then((data: CatalogCard[]) => setCatalog(data))
      .catch((err) => {
        console.error("catalog fetch failed:", err);
        setError("Could not load card catalog");
      })
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
        const res = await apiFetch("/api/user-cards", {
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
      } catch (err) {
        console.error("addCatalogCard failed:", err);
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
      const res = await apiFetch("/api/user-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customIssuer: customIssuer.trim(), customName: customName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add card");
      const data = await res.json();
      onAdded(data.id);
    } catch (err) {
      console.error("addCustomCard failed:", err);
      setError("Failed to add custom card");
    } finally {
      setAddingCustom(false);
    }
  }, [customIssuer, customName, onAdded]);

  const isAdding = addingId !== null || addingCustom;

  return (
    <FlowShell title="Add a card" subtitle="Pick the card you want to track" onClose={onClose}>
      <PickerSearch query={query} onChange={setQuery} />

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
              <CatalogRow
                key={c.id}
                card={c}
                disabled={isAdding}
                adding={addingId === c.id}
                duplicate={duplicateId === c.id}
                onAdd={addCatalogCard}
              />
            ))}
            {list.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0", color: COLORS.text4, fontSize: 13 }}>
                No matches for &ldquo;{query}&rdquo;.
              </div>
            )}
          </div>

          <CustomCardForm
            open={customOpen}
            issuer={customIssuer}
            name={customName}
            adding={addingCustom}
            disabled={isAdding}
            onOpen={() => setCustomOpen(true)}
            onIssuerChange={setCustomIssuer}
            onNameChange={setCustomName}
            onSubmit={addCustomCard}
          />
        </>
      )}
    </FlowShell>
  );
}
