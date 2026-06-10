import { describe, it, expect } from "vitest";
import {
  COLORS,
  ISSUER,
  RADII,
  SHADOWS,
  TYPE,
  SPRING,
  EASING,
  EASING_ARRAY,
  EASING_MODAL_ARRAY,
} from "@/lib/ui/tokens";
import {
  OV,
  OV_SPRING,
} from "@/components/overview/tokens";

/**
 * Task 56 guard: the canonical token module must expose the exact design-source
 * values, and the Overview re-export must not diverge from canonical.
 */
describe("canonical design tokens", () => {
  it("exports the exact design-source core palette", () => {
    expect(COLORS.bg).toBe("#0F0E0D");
    expect(COLORS.surface).toBe("#191715");
    expect(COLORS.surface2).toBe("#211E1B");
    expect(COLORS.text).toBe("#F5F1EA");
    expect(COLORS.text2).toBe("#B6AFA4");
    expect(COLORS.text3).toBe("#7C766D");
    expect(COLORS.text4).toBe("#4E4944");
    expect(COLORS.amber).toBe("#F59E0B");
    expect(COLORS.amberSoft).toBe("rgba(245,158,11,0.14)");
    expect(COLORS.green).toBe("#86EFAC");
    expect(COLORS.greenDim).toBe("rgba(134,239,172,0.18)");
  });

  it("exports the exact per-issuer color + dot identities", () => {
    expect(ISSUER.amex.color).toBe("#C9A961");
    expect(ISSUER.amex.dot).toBe("#D4B97A");
    expect(ISSUER.chase.color).toBe("#3B5BDB");
    expect(ISSUER.chase.dot).toBe("#5E7BE8");
    expect(ISSUER.capitalone.color).toBe("#B73A3A");
    expect(ISSUER.capitalone.dot).toBe("#D85959");
    expect(ISSUER.citi.color).toBe("#2E5BC9");
    expect(ISSUER.citi.dot).toBe("#557DDE");
    expect(ISSUER.discover.color).toBe("#E0741F");
    expect(ISSUER.discover.dot).toBe("#E89149");
  });

  it("exports the design-source radii, shadows, and type ramp", () => {
    expect(RADII.pill).toBe(99);
    expect(RADII.card).toBe(16);
    expect(RADII.cardLg).toBe(18);
    expect(SHADOWS.card).toBe(
      "0 22px 44px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.14) inset, 0 1px 0 rgba(0,0,0,0.4)",
    );
    expect(TYPE.hero).toEqual({ fontSize: 56, fontWeight: 600, letterSpacing: -2.2 });
  });

  it("translates the design overshoot easing into the canonical spring", () => {
    expect(SPRING).toEqual({ type: "spring", stiffness: 420, damping: 26 });
    expect(EASING).toBe("cubic-bezier(0.34, 1.2, 0.64, 1)");
    expect(EASING_ARRAY).toEqual([0.34, 1.2, 0.64, 1]);
    expect(EASING_MODAL_ARRAY).toEqual([0.34, 1.1, 0.64, 1]);
  });

  it("keeps the Overview re-export in lockstep with canonical (no drift)", () => {
    expect(OV).toBe(COLORS);
    expect(OV_SPRING).toBe(SPRING);
  });
});
