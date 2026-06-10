import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Guard for CONSTRAINT-25 / QA Finding 3 (2026-06-09).
 *
 * Framer Motion's `ease` prop accepts a cubic-bezier *array* ([x1, y1, x2, y2])
 * or a named-easing string ("easeInOut", "linear", ...). It does NOT accept a
 * CSS `cubic-bezier(...)` string — passing one crashes framer-motion v11 at
 * runtime. Neither `tsc` nor `next build` catches it; it only blows up when the
 * component actually animates. That exact bug shipped latent through Feature 9
 * and crashed the entire review-gate / scan / add-card flow until it was fixed.
 *
 * The canonical tokens (`src/lib/ui/tokens.ts`) expose BOTH forms on purpose:
 *   - EASING / EASING_MODAL              → CSS *strings* (for `style` transitions)
 *   - EASING_ARRAY / EASING_MODAL_ARRAY  → Framer *arrays* (for `ease:` props)
 *
 * This test statically scans the source tree and fails if any Framer `ease:` is
 * handed a CSS-bezier string — either an inline `"cubic-bezier(...)"` literal or
 * one of the string-typed constants (EASING / EASING_MODAL). Valid usages are
 * left untouched: the array constants, inline bezier arrays, named eases, and
 * `${EASING}` interpolated into a CSS `transition` string (that is a `style`
 * transition, not an `ease:` prop, so it is correct).
 */

// Vitest runs from the project root; resolve the source tree off the cwd so the
// scan is independent of this file's own (deeply nested) location.
const SRC_ROOT = resolve(process.cwd(), "src");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Don't scan the tests themselves — fixtures here legitimately contain
      // the offending patterns as strings (e.g. this very file).
      if (entry.name === "__tests__") continue;
      collectSourceFiles(join(dir, entry.name), out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

// A Framer `ease:` whose value is an inline CSS-bezier string literal.
const CSS_BEZIER_LITERAL = /\bease:\s*["'`]\s*cubic-bezier/;
// A Framer `ease:` whose value is a string-typed easing constant (EASING or
// EASING_MODAL) — but NOT the array forms (EASING_ARRAY / EASING_MODAL_ARRAY).
// The negative lookahead rejects a following `_`/alphanumeric so `EASING_ARRAY`
// and `EASING_MODAL_ARRAY` do not match.
const CSS_EASING_CONST = /\bease:\s*EASING(_MODAL)?(?![_A-Za-z0-9])/;

describe("Framer Motion easing guard (CONSTRAINT-25)", () => {
  it("never passes a CSS cubic-bezier string to a Framer `ease:` prop", () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (CSS_BEZIER_LITERAL.test(line) || CSS_EASING_CONST.test(line)) {
          const rel = file.slice(SRC_ROOT.length + 1).replace(/\\/g, "/");
          violations.push(`src/${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      "Framer `ease:` must use an array (EASING_ARRAY / EASING_MODAL_ARRAY / " +
        "[x, y, x, y]) or a named easing — never a CSS cubic-bezier string. " +
        `Offenders:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
