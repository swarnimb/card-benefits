"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { subscribeDemoBlocked } from "@/lib/demo/demo-api";
import { demoRepoUrl } from "@/lib/demo/demo-mode";
import { DemoReadonlyModal } from "./demo-readonly-modal";
import { COLORS, TYPE } from "@/lib/ui/tokens";

/**
 * Task 90 — slim persistent demo strip, mounted in the (app) layout on all
 * three spaces when `isDemoMode` is true. Carries the GitHub source link inline
 * and owns the "Read-only demo" modal: it subscribes to the demo-api
 * blocked-write emitter (already debounced at the source) and renders the
 * centered, dismissible DemoReadonlyModal — the friendly replacement for the old
 * bottom toast and the negative scrape/inline error states.
 */
export function DemoBanner() {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    return subscribeDemoBlocked(() => setModalOpen(true));
  }, []);

  return (
    <>
      <div
        role="note"
        data-testid="demo-banner"
        className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5"
        style={{
          background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.hairline2}`,
          color: COLORS.text2,
          ...TYPE.meta,
        }}
      >
        <span
          aria-hidden="true"
          className="inline-block size-1.5 rounded-full"
          style={{ background: COLORS.amber }}
        />
        Demo: fictional data, read-only
        <span aria-hidden="true" style={{ color: COLORS.text4 }}>
          ·
        </span>
        <a
          href={demoRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: COLORS.text, textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          View on GitHub
        </a>
      </div>
      <AnimatePresence>
        {modalOpen && <DemoReadonlyModal onClose={() => setModalOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
