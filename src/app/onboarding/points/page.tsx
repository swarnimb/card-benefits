"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PointsEntry } from "@/components/onboarding/points-entry";
import { cn } from "@/lib/utils";

type UserCardItem = {
  id: string;
  card: {
    bankName: string;
    cardName: string;
    imageColor: string;
  };
};

function parsePoints(raw: string): number | null {
  const digits = raw.replace(/,/g, "").trim();
  if (!digits) return null;
  const num = parseInt(digits, 10);
  return isNaN(num) ? null : num;
}

export default function PointsPage() {
  const router = useRouter();
  const [userCards, setUserCards] = useState<UserCardItem[]>([]);
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cards/user")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cards: ${res.status}`);
        return res.json();
      })
      .then((data: UserCardItem[]) => {
        setUserCards(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleChange = useCallback((userCardId: string, value: string) => {
    setValues((prev) => {
      const next = new Map(prev);
      next.set(userCardId, value);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Save point balances for cards that have values entered
      const saves = userCards
        .filter((uc) => {
          const points = parsePoints(values.get(uc.id) ?? "");
          return points !== null;
        })
        .map((uc) => {
          const points = parsePoints(values.get(uc.id) ?? "");
          return fetch(`/api/cards/user/${uc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointBalance: points }),
          });
        });

      const results = await Promise.all(saves);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        throw new Error(`Failed to save points: ${failed.status}`);
      }

      // Mark onboarding complete
      const stateRes = await fetch("/api/app-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorial_seen: "true" }),
      });

      if (!stateRes.ok) {
        throw new Error("Failed to complete onboarding");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }, [userCards, values, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAnyValue = userCards.some((uc) => {
    const points = parsePoints(values.get(uc.id) ?? "");
    return points !== null;
  });

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Current Points Balance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional — enter your current points so we can track them going
          forward. You can always update this later.
        </p>
      </div>

      {/* Points entry */}
      <div className="flex-1 px-6">
        <PointsEntry
          userCards={userCards}
          values={values}
          onChange={handleChange}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="px-6 text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Bottom actions */}
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-lg">
        <Button
          onClick={completeOnboarding}
          disabled={saving}
          size="lg"
          className={cn(
            "w-full text-base font-semibold",
            "transition-all duration-200 active:scale-95"
          )}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {hasAnyValue ? "Save & Continue" : "Skip for Now"}
        </Button>
      </div>
    </div>
  );
}
