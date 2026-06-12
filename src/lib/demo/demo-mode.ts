/**
 * Demo-mode flag — single source of truth for all demo gating.
 *
 * Gates the static GitHub Pages demo build. NEXT_PUBLIC_DEMO_MODE is
 * inlined at build time by Next.js, so this is a compile-time constant:
 * `true` only when the demo build runs with NEXT_PUBLIC_DEMO_MODE="true".
 */
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
