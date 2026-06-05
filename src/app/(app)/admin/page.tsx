"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { AdminHome, type ManagedCard } from "@/components/admin/admin-home";
import { AddPicker } from "@/components/admin/add-picker";
import { Scanning } from "@/components/admin/scanning";
import { BenefitReviewGate } from "@/components/admin/benefit-review-gate";
import { Toast } from "@/components/ui/toast";
import { CardDeleteFailedError } from "@/lib/errors/card-delete-failed";
import type { DraftBenefit } from "@/types/benefit";

type View = "home" | "add" | "scan" | "review";

interface ScrapeResult {
  userCardId: string;
  benefits: DraftBenefit[];
  /** Parsed card-level annual fee (USD); null when not found. Pre-fills the gate. */
  annualFee: number | null;
  scrapeError?: string;
  parseError?: string;
}

/** The card currently flowing through scan → review (subtitle + scan visuals). */
interface FlowCard {
  userCardId: string;
  name: string;
  color: string;
}

const FALLBACK_COLOR = "#64748b";

export default function AdminPage() {
  const [cards, setCards] = useState<ManagedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>("home");
  const [flowCard, setFlowCard] = useState<FlowCard | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  // freshAddCardId tracks the userCardId from the Add flow → drives whether
  // Cancel rolls back the orphan (fresh-add) or just hides the gate (re-scrape).
  const [freshAddCardId, setFreshAddCardId] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

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

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  /**
   * Drives the REAL async scrape behind the scan animation (honesty). Sets
   * `scanPending` true, awaits POST .../scrape, then stores the result. The
   * Scanning view watches `scanPending`/error and advances to review itself.
   */
  const triggerScrape = useCallback(async (userCardId: string) => {
    setScanPending(true);
    setScrapeResult(null);
    try {
      const res = await fetch(`/api/user-cards/${userCardId}/scrape`, { method: "POST" });
      if (!res.ok) throw new Error("Scrape failed");
      const data = await res.json();
      setScrapeResult({
        userCardId,
        benefits: data.benefits ?? [],
        annualFee: typeof data.annualFee === "number" ? data.annualFee : null,
        scrapeError: data.scrapeError,
        parseError: data.parseError,
      });
    } catch {
      setScrapeResult({
        userCardId,
        benefits: [],
        annualFee: null,
        scrapeError: "Failed to scrape card benefits",
      });
    } finally {
      setScanPending(false);
    }
  }, []);

  // Add flow: picker POSTs the card, hands back the userCardId → start scan.
  const handleAdded = useCallback(
    (userCardId: string) => {
      setFreshAddCardId(userCardId);
      setFlowCard({ userCardId, name: "New card", color: FALLBACK_COLOR });
      setView("scan");
      triggerScrape(userCardId);
    },
    [triggerScrape],
  );

  // Re-scrape an existing card (NOT a fresh add — Cancel won't roll back).
  const handleRescrape = useCallback(
    (userCardId: string) => {
      const card = cards.find((c) => c.id === userCardId);
      setBusyId(userCardId);
      setFlowCard({
        userCardId,
        name: card ? `${card.card.issuer} ${card.card.name}` : "Card",
        color: card?.card.defaultColor ?? FALLBACK_COLOR,
      });
      setView("scan");
      triggerScrape(userCardId);
    },
    [cards, triggerScrape],
  );

  // Scan animation has settled (or surfaced an error) → open the review gate.
  const handleScanDone = useCallback(() => {
    setBusyId(null);
    setView("review");
  }, []);

  const handleRemove = useCallback(
    async (userCardId: string) => {
      const removed = cards.find((c) => c.id === userCardId);
      try {
        const res = await fetch(`/api/user-cards/${userCardId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        await fetchCards();
        if (removed) showToast(`Removed ${removed.card.name}`);
      } catch {
        setError("Failed to remove card");
      }
    },
    [cards, fetchCards, showToast],
  );

  const handleSave = useCallback(() => {
    const saved = scrapeResult
      ? cards.find((c) => c.id === scrapeResult.userCardId)
      : null;
    const trackedCount = scrapeResult
      ? scrapeResult.benefits.filter((b) => b.tracked).length
      : 0;
    const isFreshAdd = scrapeResult ? freshAddCardId === scrapeResult.userCardId : false;
    setScrapeResult(null);
    setFreshAddCardId(null);
    setFlowCard(null);
    setView("home");
    fetchCards();
    // Toast ONLY on a fresh card add (CONSTRAINT-20). Re-scrape confirms do not
    // toast — they are not "adding" a card.
    if (isFreshAdd) {
      const label = saved ? saved.card.name : "Card";
      showToast(`${label} added · ${trackedCount} benefit${trackedCount !== 1 ? "s" : ""} tracked`);
    }
  }, [scrapeResult, cards, freshAddCardId, fetchCards, showToast]);

  /**
   * Review-gate Cancel — branches on fresh-add vs re-scrape (NEW-1).
   * Fresh-add: DELETE the orphan userCard (throws CardDeleteFailedError on
   * non-OK so the gate surfaces it — no silent swallow, EH-01). Re-scrape: just
   * return to home, DB untouched.
   */
  const handleReviewCancel = useCallback(async () => {
    if (!scrapeResult) {
      setView("home");
      setFlowCard(null);
      return;
    }
    const userCardId = scrapeResult.userCardId;
    const isFreshAdd = freshAddCardId === userCardId;

    if (!isFreshAdd) {
      setScrapeResult(null);
      setFlowCard(null);
      setView("home");
      return;
    }

    const res = await fetch(`/api/user-cards/${userCardId}`, { method: "DELETE" });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new CardDeleteFailedError(userCardId, res.status, bodyText);
    }
    setCards((prev) => prev.filter((c) => c.id !== userCardId));
    setScrapeResult(null);
    setFreshAddCardId(null);
    setFlowCard(null);
    setView("home");
  }, [scrapeResult, freshAddCardId]);

  // Cancel from the scan view (before review) — same rollback semantics.
  const handleScanCancel = useCallback(async () => {
    setBusyId(null);
    try {
      await handleReviewCancel();
    } catch {
      // If the orphan DELETE fails mid-scan, fall back to home; the orphan is
      // recoverable from the home list (user can delete manually).
      setView("home");
      setFlowCard(null);
    }
  }, [handleReviewCancel]);

  return (
    <>
      {view === "home" && (
        <AdminHome
          cards={cards}
          busyId={busyId}
          loading={loading}
          error={error}
          onAdd={() => setView("add")}
          onRescrape={handleRescrape}
          onRemove={handleRemove}
        />
      )}

      {view === "add" && (
        <AddPicker onClose={() => setView("home")} onAdded={handleAdded} />
      )}

      {view === "scan" && flowCard && (
        <Scanning
          cardName={flowCard.name}
          color={flowCard.color}
          pending={scanPending}
          errorMessage={scrapeResult?.scrapeError ?? scrapeResult?.parseError ?? null}
          onDone={handleScanDone}
          onCancel={handleScanCancel}
        />
      )}

      {view === "review" && scrapeResult && (
        <BenefitReviewGate
          userCardId={scrapeResult.userCardId}
          initialBenefits={scrapeResult.benefits}
          cardName={flowCard?.name ?? null}
          initialAnnualFee={scrapeResult.annualFee}
          scrapeError={scrapeResult.scrapeError}
          parseError={scrapeResult.parseError}
          onSave={handleSave}
          onCancel={handleReviewCancel}
        />
      )}

      <AnimatePresence>{toast && <Toast key={toast} text={toast} />}</AnimatePresence>
    </>
  );
}
