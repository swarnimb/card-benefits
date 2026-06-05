import { describe, it, expect } from "vitest";
import { darken, lighten, cardGradient } from "@/components/cards/card-gradient";

/**
 * Task 66 (folded code-review unit gap): the card-face gradient math ported from
 * the design source. Pure functions — exercise known hex → rgb() outputs plus the
 * clamp behavior at #ffffff / #000000.
 */
describe("card-gradient: lighten()", () => {
  it("lightens a known hex toward white", () => {
    // #3B5BDB = (59, 91, 219). +50% toward 255: 59+98=157, 91+82=173, 219+18=237.
    expect(lighten("#3B5BDB", 0.5)).toBe("rgb(157,173,237)");
  });

  it("lightens black by the design's 8% step", () => {
    // 0 + 255 * 0.08 = 20.4 → round 20.
    expect(lighten("#000000", 0.08)).toBe("rgb(20,20,20)");
  });

  it("clamps at white — lightening #ffffff stays #ffffff", () => {
    expect(lighten("#ffffff", 0.08)).toBe("rgb(255,255,255)");
  });
});

describe("card-gradient: darken()", () => {
  it("darkens a known hex toward black", () => {
    // #3B5BDB = (59, 91, 219). *0.5: 29.5→30, 45.5→46, 109.5→110.
    expect(darken("#3B5BDB", 0.5)).toBe("rgb(30,46,110)");
  });

  it("darkens white by the design's 22% step", () => {
    // 255 * (1 - 0.22) = 198.9 → round 199.
    expect(darken("#ffffff", 0.22)).toBe("rgb(199,199,199)");
  });

  it("clamps at black — darkening #000000 stays #000000", () => {
    expect(darken("#000000", 0.22)).toBe("rgb(0,0,0)");
  });
});

describe("card-gradient: cardGradient()", () => {
  it("composes the 150deg depth gradient: lighten 8% → base 35% → darken 22%", () => {
    expect(cardGradient("#3B5BDB")).toBe(
      "linear-gradient(150deg, rgb(75,104,222) 0%, #3B5BDB 35%, rgb(46,71,171) 100%)"
    );
  });

  it("keeps the literal base hex at the 35% stop", () => {
    expect(cardGradient("#000000")).toContain("#000000 35%");
  });
});
