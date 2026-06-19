/**
 * Demo-mode flag — single source of truth for all demo gating.
 *
 * Gates the static GitHub Pages demo build. NEXT_PUBLIC_DEMO_MODE is
 * inlined at build time by Next.js, so this is a compile-time constant:
 * `true` only when the demo build runs with NEXT_PUBLIC_DEMO_MODE="true".
 */
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * Base path of the deployed demo (GitHub Pages serves the static export at
 * https://swarnimb.github.io/card-benefits/). Single source of truth shared
 * with `next.config.ts` (basePath) and the demo fixture fetches in
 * `demo-api.ts` — fixture URLs must be absolute-with-basePath because
 * relative URLs break under nested routes.
 */
export const demoBasePath = "/card-benefits";

/**
 * Public source repository for the demo. Surfaced from the demo banner and the
 * read-only modal so a visitor can jump straight from the live demo to the code.
 */
export const demoRepoUrl = "https://github.com/swarnimb/card-benefits";
