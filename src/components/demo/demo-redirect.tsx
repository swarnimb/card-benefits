"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Static-export-safe client-side redirect for the demo build (Task 91).
 *
 * Server `redirect()` never runs on GitHub Pages (no server), so demo
 * pages render this instead. `useRouter` handles `basePath` automatically,
 * so `to` is always the bare app path (e.g. "/overview").
 */
export function DemoRedirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return null;
}
