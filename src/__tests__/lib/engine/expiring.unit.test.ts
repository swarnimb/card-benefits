import { describe, it, expect } from "vitest";
import { unusedFromParts } from "@/lib/engine/expiring";

describe("unusedFromParts", () => {
  it("subscription with usedAmount > 0 → 0 (already claimed)", () => {
    expect(unusedFromParts("subscription", 240, 1)).toBe(0);
  });

  it("subscription not yet claimed (used === 0) → full value", () => {
    expect(unusedFromParts("subscription", 240, 0)).toBe(240);
  });

  it("value === null (unlimited) → 0", () => {
    expect(unusedFromParts("credit", null, 50)).toBe(0);
  });

  it("normal capped case → value − used", () => {
    expect(unusedFromParts("credit", 100, 30)).toBe(70);
  });

  it("capped case floors at 0 when used exceeds value", () => {
    expect(unusedFromParts("credit", 100, 150)).toBe(0);
  });
});
