"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, emitDemoBlocked } from "@/lib/demo/demo-api";
import { isDemoMode } from "@/lib/demo/demo-mode";
import type { ManagedCard } from "@/components/admin/admin-home";
import { CardDeleteFailedError } from "@/lib/errors/card-delete-failed";
import type { DraftBenefit } from "@/types/benefit";

export type AdminView = "home" | "add" | "scan" | "review";

export interface ScrapeResult {
  userCardId: string;
  benefits: DraftBenefit[];
  /** Parsed card-level annual fee (USD); null when not found. Pre-fills the gate. */
  annualFee: number | null;
  scrapeError?: string;
  parseError?: string;
}

/** The card currently flowing through scan → review (subtitle + scan visuals). */
export interface FlowCard {
  userCardId: string;
  name: string;
  color: string;
}

const FALLBACK_COLOR = "#64748b";

/** Everything the AdminPage component needs to render the 4 views + toast. */
export interface AdminFlow {
  cards: ManagedCard[];
  loading: boolean;
  error: string | null;
  view: AdminView;
  setView: (view: AdminView) => void;
  flowCard: FlowCard | null;
  scanPending: boolean;
  scrapeResult: ScrapeResult | null;
  busyId: string | null;
  toast: string | null;
  handleAdded: (userCardId: string) => void;
  handleRescrape: (userCardId: string) => void;
  handleScanDone: () => void;
  handleRemove: (userCardId: string) => Promise<void>;
  handleSave: () => void;
  handleReviewCancel: () => Promise<void>;
  handleScanCancel: () => Promise<void>;
}

/**
 * Owns the admin flow state machine (home → add → scan → review) and every
 * mutation handler. Extracted from AdminPage to keep the page component a thin
 * view-renderer. Preserves orphan-card rollback (fresh-add cancel → DELETE;
 * re-scrape cancel → no DELETE), loud CardDeleteFailedError, EH-03 console.error
 * logging, toast-only-on-add/remove, and the no-auto-save review gate.
 */
export function useAdminFlow(): AdminFlow {
  const [cards, setCards] = useState<ManagedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<AdminView>("home");
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
      const res = await apiFetch("/api/user-cards");
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
      const res = await apiFetch(`/api/user-cards/${userCardId}/scrape`, { method: "POST" });
      if (!res.ok) throw new Error("Scrape failed");
      const data = await res.json();
      // Demo: the scrape is an instant no-op, so hold pending long enough for the
      // scan animation to play its stepped sequence before handleScanDone shows
      // the read-only modal (scan-then-modal, not an instant pop).
      if (isDemoMode) await new Promise((resolve) => setTimeout(resolve, 1900));
      setScrapeResult({
        userCardId,
        benefits: data.benefits ?? [],
        annualFee: typeof data.annualFee === "number" ? data.annualFee : null,
        scrapeError: data.scrapeError,
        parseError: data.parseError,
      });
    } catch (err) {
      console.error(`scrape failed (userCardId=${userCardId})`, err);
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
  // Demo: the scrape was a no-op (no card was ever scanned), so instead of an
  // empty review gate, return home and show the read-only modal (scan-then-modal).
  const handleScanDone = useCallback(() => {
    setBusyId(null);
    if (isDemoMode) {
      emitDemoBlocked();
      setScrapeResult(null);
      setFreshAddCardId(null);
      setFlowCard(null);
      setView("home");
      return;
    }
    setView("review");
  }, []);

  const handleRemove = useCallback(
    async (userCardId: string) => {
      const removed = cards.find((c) => c.id === userCardId);
      try {
        const res = await apiFetch(`/api/user-cards/${userCardId}`, { method: "DELETE" });
        if (!res.ok) {
          // Demo: DELETE is blocked read-only — apiFetch already fired the modal.
          // Return gracefully (nothing removed) instead of a "Failed to remove" error.
          if (isDemoMode) return;
          throw new Error("Delete failed");
        }
        await fetchCards();
        if (removed) showToast(`Removed ${removed.card.name}`);
      } catch (err) {
        console.error(`remove card failed (userCardId=${userCardId})`, err);
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

    const res = await apiFetch(`/api/user-cards/${userCardId}`, { method: "DELETE" });
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
    } catch (err) {
      console.error("scan-cancel rollback failed", err);
      // If the orphan DELETE fails mid-scan, fall back to home; the orphan is
      // recoverable from the home list (user can delete manually).
      setView("home");
      setFlowCard(null);
    }
  }, [handleReviewCancel]);

  return {
    cards,
    loading,
    error,
    view,
    setView,
    flowCard,
    scanPending,
    scrapeResult,
    busyId,
    toast,
    handleAdded,
    handleRescrape,
    handleScanDone,
    handleRemove,
    handleSave,
    handleReviewCancel,
    handleScanCancel,
  };
}
