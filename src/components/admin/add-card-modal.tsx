"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogCard } from "@/types/card";

/** Props for AddCardModal. */
export interface AddCardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (userCardId: string) => void;
}

function groupByIssuer(cards: CatalogCard[]): Map<string, CatalogCard[]> {
  const map = new Map<string, CatalogCard[]>();
  for (const card of cards) {
    const group = map.get(card.issuer) ?? [];
    group.push(card);
    map.set(card.issuer, group);
  }
  return map;
}

/** Modal for adding a card from catalog or as a custom entry. */
export function AddCardModal({ open, onClose, onSuccess }: AddCardModalProps) {
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIssuer, setExpandedIssuer] = useState<string | null>(null);
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customIssuer, setCustomIssuer] = useState("");
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setDuplicateId(null);
    setExpandedIssuer(null);
    setCustomIssuer("");
    setCustomName("");
    fetch("/api/catalog")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load catalog");
        return res.json();
      })
      .then((data: CatalogCard[]) => setCatalog(data))
      .catch(() => setError("Could not load card catalog"))
      .finally(() => setLoading(false));
  }, [open]);

  const addCatalogCard = useCallback(
    async (catalogCardId: string) => {
      setAddingCardId(catalogCardId);
      setDuplicateId(null);
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
        onSuccess(data.id);
        onClose();
      } catch {
        setError("Failed to add card");
      } finally {
        setAddingCardId(null);
      }
    },
    [onSuccess, onClose]
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
      onSuccess(data.id);
      onClose();
    } catch {
      setError("Failed to add custom card");
    } finally {
      setAddingCustom(false);
    }
  }, [customIssuer, customName, onSuccess, onClose]);

  const issuerGroups = groupByIssuer(catalog);
  const isAdding = addingCardId !== null || addingCustom;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a Card</DialogTitle>
          <DialogDescription>Choose from the catalog or add a custom card.</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-4">Loading catalog...</p>}
        {error && <p className="text-sm text-destructive py-2">{error}</p>}

        {!loading && (
          <div className="space-y-1">
            {[...issuerGroups.entries()].map(([issuer, cards]) => (
              <div key={issuer}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  onClick={() => setExpandedIssuer(expandedIssuer === issuer ? null : issuer)}
                >
                  {issuer}
                  <ChevronDown
                    className={`size-4 transition-transform ${expandedIssuer === issuer ? "rotate-180" : ""}`}
                  />
                </button>
                {expandedIssuer === issuer && (
                  <div className="space-y-1 pl-3 pb-2">
                    {cards.map((card) => (
                      <div key={card.id} className="flex items-center justify-between rounded-md px-3 py-1.5">
                        <span className="text-sm">{card.name}</span>
                        <div className="flex items-center gap-2">
                          {duplicateId === card.id && (
                            <span className="text-xs text-destructive">You already have this card</span>
                          )}
                          <Button
                            size="xs"
                            disabled={isAdding}
                            onClick={() => addCatalogCard(card.id)}
                          >
                            {addingCardId === card.id ? "Adding..." : "Add"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="border-t pt-4 mt-2 space-y-3">
            <p className="text-sm font-medium">Custom Card</p>
            <Input
              placeholder="Issuer (e.g. US Bank)"
              value={customIssuer}
              onChange={(e) => setCustomIssuer(e.target.value)}
            />
            <Input
              placeholder="Card name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!customIssuer.trim() || !customName.trim() || isAdding}
              onClick={addCustomCard}
            >
              {addingCustom ? "Adding..." : "Add Custom Card"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
