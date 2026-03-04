"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PointsEstimate } from "@/types/card";

interface PointsDisplayProps {
  userCardId: string;
  points: PointsEstimate;
  onBalanceUpdated?: () => void;
}

export function PointsDisplay({
  userCardId,
  points,
  onBalanceUpdated,
}: PointsDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasBaseline = points.baseline !== null;

  useEffect(() => {
    if (editing) {
      setEditValue(points.baseline?.toString() ?? "");
      // Focus after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, points.baseline]);

  async function handleSave() {
    const parsed = editValue.trim() === "" ? null : Number(editValue);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/cards/user/${userCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointBalance: parsed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update balance");
      }

      setEditing(false);
      onBalanceUpdated?.();
    } catch (e) {
      console.error("Points update failed:", e);
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  }

  // Format number with commas
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Points
          </h3>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            {hasBaseline ? "Update" : "Set balance"}
          </button>
        )}
      </div>

      {saveError && (
        <p className="mt-2 text-xs font-medium text-destructive">{saveError}</p>
      )}

      {editing ? (
        /* Inline edit mode */
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min="0"
            placeholder="Enter current balance"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={cn(
              "h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm",
              "placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:opacity-50"
            )}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : hasBaseline ? (
        /* Has baseline — show total with breakdown */
        <div className="mt-2">
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {fmt(points.total)}
          </p>
          {points.estimated > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmt(points.baseline!)} base + {fmt(points.estimated)} estimated
            </p>
          )}
          {points.balanceAsOf && (
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              Balance set{" "}
              {new Date(points.balanceAsOf).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
      ) : (
        /* No baseline — prompt to enter */
        <div className="mt-2">
          {points.estimated > 0 ? (
            <>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-muted-foreground/50">
                ~{fmt(points.estimated)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Estimated from transactions &middot; set your balance for accuracy
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tap &ldquo;Set balance&rdquo; to track your points
            </p>
          )}
        </div>
      )}
    </div>
  );
}
