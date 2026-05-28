"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";

/** Props for ScrapeOverlay. */
export interface ScrapeOverlayProps {
  /** When true, the overlay covers the screen (including the bottom nav). */
  visible: boolean;
  /** Display name of the card being scraped; falls back to generic copy. */
  cardName?: string | null;
}

/**
 * Full-screen, non-dismissible loading overlay shown while a card scrape runs
 * (a ~30-40s blocking call). It sits above the bottom nav (z-[60] > nav z-50)
 * so the user cannot navigate away mid-scrape — this structurally prevents the
 * NEW-7 fresh-add orphan-card path (Task G1 superseded). Errors are not handled
 * here: every scrape outcome (success or failure) flows to the review gate,
 * which already surfaces scrape/parse errors and offers manual entry.
 */
export function ScrapeOverlay({ visible, cardName }: ScrapeOverlayProps) {
  const reduceMotion = useReducedMotion();
  const title = cardName ? `Scraping ${cardName}…` : "Scraping benefits…";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="px-6 text-center">
            <p className="text-base font-medium text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This usually takes 30–40 seconds
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
