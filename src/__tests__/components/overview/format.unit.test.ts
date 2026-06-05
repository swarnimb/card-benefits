import { describe, it, expect } from "vitest";
import { usd } from "@/components/overview/format";

/**
 * Task 66 (folded code-review unit gap): the Overview `usd()` formatter ported
 * from the design source. Rounds to whole dollars, locale-groups thousands,
 * prefixes "$". Covers rounding, thousands separators, zero, and negatives.
 */
describe("format: usd()", () => {
  it("rounds to the nearest whole dollar (half-up)", () => {
    expect(usd(120.4)).toBe("$120");
    expect(usd(120.5)).toBe("$121");
    expect(usd(0.49)).toBe("$0");
  });

  it("groups thousands with a comma", () => {
    expect(usd(1245)).toBe("$1,245");
    expect(usd(1000000)).toBe("$1,000,000");
  });

  it("formats zero", () => {
    expect(usd(0)).toBe("$0");
  });

  it("formats negative amounts (rounded + grouped)", () => {
    expect(usd(-50)).toBe("$-50");
    expect(usd(-1234.6)).toBe("$-1,235");
  });
});
