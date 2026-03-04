"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  CreditCard,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPicker } from "@/components/onboarding/card-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import type { UserCardWithCard, CardWithBenefits } from "@/types/card";

type CardItem = {
  id: string;
  bankName: string;
  cardName: string;
  annualFee: number;
  imageColor: string;
};

export default function SettingsPage() {
  const [userCards, setUserCards] = useState<UserCardWithCard[]>([]);
  const [allCards, setAllCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add card flow
  const [showAddCards, setShowAddCards] = useState(false);
  const [addSelectedIds, setAddSelectedIds] = useState<Set<string>>(new Set());
  const [addSaving, setAddSaving] = useState(false);

  // Inline point editing
  const [editingPointsId, setEditingPointsId] = useState<string | null>(null);
  const [editPointsValue, setEditPointsValue] = useState("");
  const [savingPoints, setSavingPoints] = useState(false);

  // Delete card confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserCardWithCard | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // Data management confirmations
  const [clearTransTarget, setClearTransTarget] =
    useState<UserCardWithCard | null>(null);
  const [clearingTrans, setClearingTrans] = useState(false);
  const [showClearAllTrans, setShowClearAllTrans] = useState(false);
  const [clearingAllTrans, setClearingAllTrans] = useState(false);
  const [showNuclearReset, setShowNuclearReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [userRes, allRes] = await Promise.all([
        fetch("/api/cards/user"),
        fetch("/api/cards"),
      ]);

      if (!userRes.ok) throw new Error(`Failed to load user cards: ${userRes.status}`);
      if (!allRes.ok) throw new Error(`Failed to load cards: ${allRes.status}`);

      const userData: UserCardWithCard[] = await userRes.json();
      const allData: CardWithBenefits[] = await allRes.json();

      setUserCards(userData);
      setAllCards(
        allData.map((c) => ({
          id: c.id,
          bankName: c.bankName,
          cardName: c.cardName,
          annualFee: c.annualFee,
          imageColor: c.imageColor,
        }))
      );
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Card Management ----

  const existingCardIds = new Set(userCards.map((uc) => uc.cardId));
  const availableCards = allCards.filter((c) => !existingCardIds.has(c.id));

  const handleAddCards = useCallback(async () => {
    if (addSelectedIds.size === 0) return;
    setAddSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/cards/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: Array.from(addSelectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Add failed: ${res.status}`);
      }
      setShowAddCards(false);
      setAddSelectedIds(new Set());
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add cards");
    } finally {
      setAddSaving(false);
    }
  }, [addSelectedIds, fetchData]);

  const handleDeleteCard = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/cards/user/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchData]);

  const handleSavePoints = useCallback(
    async (userCardId: string) => {
      const parsed =
        editPointsValue.trim() === "" ? null : Number(editPointsValue);
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

      setSavingPoints(true);
      try {
        const res = await fetch(`/api/cards/user/${userCardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pointBalance: parsed }),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
        setEditingPointsId(null);
        await fetchData();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update points"
        );
      } finally {
        setSavingPoints(false);
      }
    },
    [editPointsValue, fetchData]
  );

  // ---- Data Management ----

  const handleClearTransactions = useCallback(async () => {
    if (!clearTransTarget) return;
    setClearingTrans(true);

    try {
      const res = await fetch(
        `/api/transactions/${clearTransTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`Clear failed: ${res.status}`);
      setClearTransTarget(null);
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear transactions"
      );
    } finally {
      setClearingTrans(false);
    }
  }, [clearTransTarget, fetchData]);

  const handleClearAllTransactions = useCallback(async () => {
    setClearingAllTrans(true);
    try {
      for (const uc of userCards) {
        const res = await fetch(`/api/transactions/${uc.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`Failed to clear ${uc.card.cardName}: ${res.status}`);
      }
      setShowClearAllTrans(false);
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear transactions"
      );
    } finally {
      setClearingAllTrans(false);
    }
  }, [userCards, fetchData]);

  const handleNuclearReset = useCallback(async () => {
    setResetting(true);
    try {
      // Delete all user cards (cascades transactions)
      for (const uc of userCards) {
        const res = await fetch(`/api/cards/user/${uc.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete ${uc.card.cardName}: ${res.status}`);
      }
      // Reset app state
      const stateRes = await fetch("/api/app-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorial_seen: "false" }),
      });
      if (!stateRes.ok) throw new Error(`Failed to reset app state: ${stateRes.status}`);
      // Full reload to re-execute server component redirect at /
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setResetting(false);
    }
  }, [userCards]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="flex flex-col gap-8">
          {/* ---- Section: Your Cards ---- */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Cards
              </h2>
              {availableCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddCards(!showAddCards)}
                  className="flex items-center gap-1 text-xs font-medium text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add card
                </button>
              )}
            </div>

            {/* Add card picker (toggleable) */}
            {showAddCards && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <CardPicker
                  cards={availableCards}
                  selectedIds={addSelectedIds}
                  onToggle={(id) => {
                    setAddSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddCards(false);
                      setAddSelectedIds(new Set());
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={addSelectedIds.size === 0 || addSaving}
                    onClick={handleAddCards}
                    className="flex-1"
                  >
                    {addSaving ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    Add {addSelectedIds.size || ""}
                  </Button>
                </div>
              </div>
            )}

            {/* Card list */}
            {userCards.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No cards added yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {userCards.map((uc) => {
                  const isEditingPoints = editingPointsId === uc.id;
                  return (
                    <div
                      key={uc.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      {/* Card color */}
                      <div
                        className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: uc.card.imageColor }}
                      >
                        <CreditCard
                          className="h-5 w-5 text-white/80"
                          strokeWidth={1.5}
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {uc.card.cardName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {uc.card.bankName}
                        </p>

                        {/* Points inline edit */}
                        {isEditingPoints ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              placeholder="Points"
                              value={editPointsValue}
                              onChange={(e) =>
                                setEditPointsValue(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSavePoints(uc.id);
                                if (e.key === "Escape")
                                  setEditingPointsId(null);
                              }}
                              disabled={savingPoints}
                              className="h-7 w-24 rounded border border-border bg-background px-2 text-xs focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePoints(uc.id)}
                              disabled={savingPoints}
                              className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPointsId(null)}
                              className="flex h-7 w-7 items-center justify-center rounded border border-border"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPointsId(uc.id);
                              setEditPointsValue(
                                uc.pointBalance?.toString() ?? ""
                              );
                            }}
                            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                            {uc.pointBalance != null
                              ? `${uc.pointBalance.toLocaleString()} pts`
                              : "Set points"}
                          </button>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(uc)}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---- Section: Data Management ---- */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data
            </h2>

            <div className="flex flex-col gap-2">
              {/* Clear transactions per card */}
              {userCards.map((uc) => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => setClearTransTarget(uc)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border p-3 text-left",
                    "transition-colors hover:border-muted-foreground/30"
                  )}
                >
                  <Trash2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Clear {uc.card.cardName} transactions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Removes all imported transactions for this card
                    </p>
                  </div>
                </button>
              ))}

              {/* Clear all transactions */}
              {userCards.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowClearAllTrans(true)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border p-3 text-left",
                    "transition-colors hover:border-muted-foreground/30"
                  )}
                >
                  <Trash2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Clear all transactions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Removes all imported transactions across all cards
                    </p>
                  </div>
                </button>
              )}

              {/* Nuclear reset */}
              <button
                type="button"
                onClick={() => setShowNuclearReset(true)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-destructive/30 p-3 text-left",
                  "transition-colors hover:border-destructive/60 hover:bg-destructive/5"
                )}
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Reset everything
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Removes all cards, transactions, and returns to onboarding
                  </p>
                </div>
              </button>
            </div>
          </section>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-4 text-center text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* ---- Dialogs ---- */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove card?"
        description={`This will remove ${deleteTarget?.card.cardName ?? "this card"} and all its imported transactions. This can't be undone.`}
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDeleteCard}
      />

      <ConfirmDialog
        open={!!clearTransTarget}
        onOpenChange={(open) => !open && setClearTransTarget(null)}
        title="Clear transactions?"
        description={`This will delete all imported transactions for ${clearTransTarget?.card.cardName ?? "this card"}. The card and its benefits will remain.`}
        confirmLabel="Clear"
        destructive
        loading={clearingTrans}
        onConfirm={handleClearTransactions}
      />

      <ConfirmDialog
        open={showClearAllTrans}
        onOpenChange={setShowClearAllTrans}
        title="Clear all transactions?"
        description="This will delete all imported transactions across all your cards. Cards and benefits will remain."
        confirmLabel="Clear all"
        destructive
        loading={clearingAllTrans}
        onConfirm={handleClearAllTransactions}
      />

      <ConfirmDialog
        open={showNuclearReset}
        onOpenChange={setShowNuclearReset}
        title="Reset everything?"
        description="This will delete all your cards, transactions, and settings. You'll start over from the tutorial. This can't be undone."
        confirmLabel="Reset"
        destructive
        loading={resetting}
        onConfirm={handleNuclearReset}
      />
    </div>
  );
}
