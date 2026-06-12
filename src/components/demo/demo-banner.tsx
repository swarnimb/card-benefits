"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { subscribeDemoBlocked } from "@/lib/demo/demo-api";
import { Toast } from "@/components/ui/toast";
import { COLORS, TYPE } from "@/lib/ui/tokens";

/** Matches the Admin flow's toast auto-dismiss (~2.6s). */
const TOAST_DISMISS_MS = 2600;

/**
 * Task 90 — slim persistent demo strip, mounted in the (app) layout on all
 * three spaces when `isDemoMode` is true. Also owns the "Read-only demo"
 * toast: it subscribes to the demo-api blocked-write emitter (already
 * debounced at the source) and renders the shared Toast component.
 */
export function DemoBanner() {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeDemoBlocked(() => {
      setToast("Read-only demo");
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setToast(null), TOAST_DISMISS_MS);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timerRef.current);
    };
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
        Demo — fictional data, read-only
      </div>
      <AnimatePresence>{toast && <Toast key={toast} text={toast} />}</AnimatePresence>
    </>
  );
}
