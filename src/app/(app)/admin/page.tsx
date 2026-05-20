"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCardModal } from "@/components/admin/add-card-modal";
import { BenefitReviewGate } from "@/components/admin/benefit-review-gate";
import { CardManagementList, type ManagedCard } from "@/components/admin/card-management-list";
import { CardDeleteFailedError } from "@/lib/errors/card-delete-failed";
import type { DraftBenefit } from "@/types/benefit";

interface ScrapeResult {
  userCardId: string;
  benefits: DraftBenefit[];
  scrapeError?: string;
  parseError?: string;
}

export default function AdminPage() {
  const [cards, setCards] = useState<ManagedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [scraping, setScraping] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  // freshAddCardId tracks the userCardId that came from the Add Card flow.
  // Used by handleReviewCancel to decide whether Cancel rolls back the card
  // (fresh-add) or just hides the gate (re-scrape of an existing card).
  const [freshAddCardId, setFreshAddCardId] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user-cards");
      if (!res.ok) throw new Error("Failed to load cards");
      setCards(await res.json());
    } catch {
      setError("Could not load cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const triggerScrape = useCallback(async (userCardId: string) => {
    setScraping(userCardId);
    try {
      const res = await fetch(`/api/user-cards/${userCardId}/scrape`, { method: "POST" });
      if (!res.ok) throw new Error("Scrape failed");
      const data = await res.json();
      setScrapeResult({
        userCardId,
        benefits: data.benefits ?? [],
        scrapeError: data.scrapeError,
        parseError: data.parseError,
      });
    } catch {
      setScrapeResult({
        userCardId,
        benefits: [],
        scrapeError: "Failed to scrape card benefits",
      });
    } finally {
      setScraping(null);
    }
  }, []);

  const handleRemove = useCallback(async (userCardId: string) => {
    try {
      const res = await fetch(`/api/user-cards/${userCardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchCards();
    } catch {
      setError("Failed to remove card");
    }
  }, [fetchCards]);

  const handleAddSuccess = useCallback((userCardId: string) => {
    setAddModalOpen(false);
    // Mark this userCard as fresh-add BEFORE the scrape runs. If the user
    // cancels the review gate, handleReviewCancel will roll back the orphan.
    setFreshAddCardId(userCardId);
    triggerScrape(userCardId);
  }, [triggerScrape]);

  /**
   * Review-gate Cancel — branches on fresh-add vs re-scrape (NEW-1).
   *
   * Fresh-add (card was just created by Add Card flow): DELETEs the userCard
   * to roll back the orphan. Throws CardDeleteFailedError on non-OK response
   * so BenefitReviewGate can surface the failure (no silent swallow).
   *
   * Re-scrape (existing card): just hides the gate — DB is untouched.
   */
  const handleReviewCancel = useCallback(async () => {
    if (!scrapeResult) return;
    const userCardId = scrapeResult.userCardId;
    const isFreshAdd = freshAddCardId === userCardId;

    if (!isFreshAdd) {
      setScrapeResult(null);
      return;
    }

    const res = await fetch(`/api/user-cards/${userCardId}`, { method: "DELETE" });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new CardDeleteFailedError(userCardId, res.status, bodyText);
    }
    // Optimistic local removal — avoids a refetch race. List is authoritative
    // on next mount/refresh anyway.
    setCards((prev) => prev.filter((c) => c.id !== userCardId));
    setScrapeResult(null);
    setFreshAddCardId(null);
  }, [scrapeResult, freshAddCardId]);

  if (scrapeResult) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <h1 className="mb-4 text-lg font-semibold">Review Benefits</h1>
        <BenefitReviewGate
          userCardId={scrapeResult.userCardId}
          initialBenefits={scrapeResult.benefits}
          scrapeError={scrapeResult.scrapeError}
          parseError={scrapeResult.parseError}
          onSave={() => {
            setScrapeResult(null);
            setFreshAddCardId(null);
            fetchCards();
          }}
          onCancel={handleReviewCancel}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Button size="sm" onClick={() => setAddModalOpen(true)}>
          <Plus className="size-4" />
          Add Card
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading cards...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && cards.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No cards yet — add your first card.</p>
          <Button className="mt-4" onClick={() => setAddModalOpen(true)}>
            <Plus className="size-4" />
            Add Card
          </Button>
        </div>
      )}

      {!loading && cards.length > 0 && (
        <>
          {scraping && (
            <p className="mb-2 text-sm text-muted-foreground">Scraping benefits...</p>
          )}
          <CardManagementList
            cards={cards}
            onRescrape={triggerScrape}
            onRemove={handleRemove}
          />
        </>
      )}

      <AddCardModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}
