import type { ReactNode } from "react";
import { createElement } from "react";
import type { Issuer } from "@/types/card";
import type { OverviewCategoryGroup } from "@/types/api";

/**
 * Overview-space formatting helpers. Ports the design source's `usd()` and the
 * issuer / category-glyph maps onto the real data contract.
 *
 * Reconciliation note: the design mock keyed issuer styling off lowercase token
 * keys (`amex`, `chase`…) via an `ISSUERS` table. The real `OverviewBenefit`
 * already carries a per-card `cardColor` (the issuer's catalog color) and a
 * display-name `issuer` ("Amex", "Capital One"…). So colors come straight from
 * `cardColor` (no key lookup needed) and the issuer label is just the display
 * name — already human-readable. `humanizeIssuer` exists for the brief's
 * requested normalization and as a safe passthrough.
 */

/** Rounded USD, locale-grouped — ported from the design source `usd()`. */
export const usd = (n: number): string =>
  "$" + Math.round(n).toLocaleString("en-US");

/**
 * The real `Issuer` type is already a display name. This passthrough keeps the
 * label rendering centralized (and lets us normalize spacing/casing later in
 * one place) without inventing a parallel lowercase-key map that the data does
 * not use.
 */
export function humanizeIssuer(issuer: Issuer): string {
  return issuer;
}

/** Single SVG glyph per Overview display group — ported from the design source. */
export function categoryGlyph(group: OverviewCategoryGroup): ReactNode {
  switch (group) {
    case "Travel":
      return createElement(
        "svg",
        { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
        createElement("path", {
          d: "M3 12l18-8-6 18-3-7-9-3z",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinejoin: "round",
        }),
      );
    case "Dining":
      return createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
        createElement("path", {
          d: "M7 3v18M11 3v8a2 2 0 01-2 2H7M15 3c-1 2-1 5 0 7v11",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinecap: "round",
        }),
      );
    case "Lifestyle":
      return createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
        createElement("path", {
          d: "M5 8h14l-1 12H6L5 8zM9 8V5a3 3 0 016 0v3",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      );
    case "Wellness":
      return createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
        createElement("path", {
          d: "M12 21s-7-4.5-7-10a4 4 0 017-2 4 4 0 017 2c0 5.5-7 10-7 10z",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinejoin: "round",
        }),
      );
    default:
      return null;
  }
}
