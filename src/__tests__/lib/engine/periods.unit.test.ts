import { describe, it, expect } from "vitest";
import { calculatePeriodBoundary } from "@/lib/engine/periods";

describe("calculatePeriodBoundary — calendar anchor", () => {
  it("monthly: returns Apr 1–Apr 30 when now = Apr 15", () => {
    const now = new Date(2026, 3, 15);
    const { periodStart, periodEnd } = calculatePeriodBoundary("monthly", "calendar", now);
    expect(periodStart).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
    expect(periodEnd).toEqual(new Date(2026, 3, 30, 23, 59, 59, 999));
  });

  it("quarterly: returns Apr 1–Jun 30 when now = May 1", () => {
    const now = new Date(2026, 4, 1);
    const { periodStart, periodEnd } = calculatePeriodBoundary("quarterly", "calendar", now);
    expect(periodStart).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
    expect(periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it("annual: returns Jan 1–Dec 31 of current year", () => {
    const now = new Date(2026, 6, 15);
    const { periodStart, periodEnd } = calculatePeriodBoundary("annual", "calendar", now);
    expect(periodStart).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(periodEnd).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it("once: returns periodEnd = null", () => {
    const now = new Date(2026, 3, 15);
    const { periodStart, periodEnd } = calculatePeriodBoundary("once", "calendar", now);
    expect(periodStart).toEqual(now);
    expect(periodEnd).toBeNull();
  });
});

describe("calculatePeriodBoundary — statement anchor", () => {
  it("returns correct period when current day is after statement day", () => {
    // now = Apr 20, statementDay = 15 → period is Apr 15–May 14
    const now = new Date(2026, 3, 20);
    const { periodStart, periodEnd } = calculatePeriodBoundary("monthly", "statement", now, 15);
    expect(periodStart).toEqual(new Date(2026, 3, 15));
    expect(periodEnd).toEqual(new Date(2026, 4, 14, 23, 59, 59, 999));
  });

  it("returns correct period when current day is before statement day", () => {
    // now = Apr 10, statementDay = 15 → period is Mar 15–Apr 14
    const now = new Date(2026, 3, 10);
    const { periodStart, periodEnd } = calculatePeriodBoundary("monthly", "statement", now, 15);
    expect(periodStart).toEqual(new Date(2026, 2, 15));
    expect(periodEnd).toEqual(new Date(2026, 3, 14, 23, 59, 59, 999));
  });
});

describe("calculatePeriodBoundary — anniversary anchor", () => {
  it("returns period from this year's anniversary when now is after it", () => {
    // now = Apr 15 2026, anniversary = Mar 1 → period Mar 1 2026–Feb 28 2027
    const now = new Date(2026, 3, 15);
    const anniversaryDate = new Date(2025, 2, 1);
    const { periodStart, periodEnd } = calculatePeriodBoundary("annual", "anniversary", now, undefined, anniversaryDate);
    expect(periodStart).toEqual(new Date(2026, 2, 1));
    expect(periodEnd).toEqual(new Date(2027, 1, 28, 23, 59, 59, 999));
  });

  it("returns period from last year's anniversary when now is before it", () => {
    // now = Feb 1 2026, anniversary = Mar 1 → period Mar 1 2025–Feb 28 2026
    const now = new Date(2026, 1, 1);
    const anniversaryDate = new Date(2025, 2, 1);
    const { periodStart, periodEnd } = calculatePeriodBoundary("annual", "anniversary", now, undefined, anniversaryDate);
    expect(periodStart).toEqual(new Date(2025, 2, 1));
    expect(periodEnd).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
  });
});

describe("calculatePeriodBoundary — semiannual", () => {
  // Calendar anchor: H1 = Jan 1 – Jun 30 23:59:59; H2 = Jul 1 – Dec 31 23:59:59.
  it("calendar: returns H1 (Jan 1 – Jun 30) when now = Mar 15 2026", () => {
    const now = new Date(2026, 2, 15);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "calendar", now);
    expect(periodStart).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it("calendar: returns H2 (Jul 1 – Dec 31) when now = Aug 15 2026", () => {
    const now = new Date(2026, 7, 15);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "calendar", now);
    expect(periodStart).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(periodEnd).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it("calendar: H1/H2 boundary flip at midnight Jul 1", () => {
    // Last instant of H1
    const endOfH1 = new Date(2026, 5, 30, 23, 59, 59);
    const h1 = calculatePeriodBoundary("semiannual", "calendar", endOfH1);
    expect(h1.periodStart).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(h1.periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
    // First instant of H2
    const startOfH2 = new Date(2026, 6, 1, 0, 0, 0);
    const h2 = calculatePeriodBoundary("semiannual", "calendar", startOfH2);
    expect(h2.periodStart).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(h2.periodEnd).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  // Statement anchor: 6-month window aligned to statementDay, cycle boundaries
  // measured from anchor-month modulo 6.
  it("statement: mid-cycle returns Jan 15 – Jul 14 when now = Apr 20, statementDay = 15", () => {
    const now = new Date(2026, 3, 20);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "statement", now, 15);
    expect(periodStart).toEqual(new Date(2026, 0, 15));
    expect(periodEnd).toEqual(new Date(2026, 6, 14, 23, 59, 59, 999));
  });

  it("statement: at boundary returns the new window when now = Jul 15, statementDay = 15", () => {
    const now = new Date(2026, 6, 15);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "statement", now, 15);
    expect(periodStart).toEqual(new Date(2026, 6, 15));
    expect(periodEnd).toEqual(new Date(2027, 0, 14, 23, 59, 59, 999));
  });

  it("statement: year-boundary case — now = Dec 20 2026 returns Jul 15 2026 – Jan 14 2027", () => {
    const now = new Date(2026, 11, 20);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "statement", now, 15);
    expect(periodStart).toEqual(new Date(2026, 6, 15));
    expect(periodEnd).toEqual(new Date(2027, 0, 14, 23, 59, 59, 999));
  });

  // Anniversary anchor: H1 = anniv..+6mo, H2 = +6mo..+12mo.
  it("anniversary: H1 (first 6 months) when now = Apr 15 2026, anniv = Mar 1", () => {
    const now = new Date(2026, 3, 15);
    const anniversaryDate = new Date(2025, 2, 1);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "anniversary", now, undefined, anniversaryDate);
    expect(periodStart).toEqual(new Date(2026, 2, 1));
    expect(periodEnd).toEqual(new Date(2026, 7, 31, 23, 59, 59, 999));
  });

  it("anniversary: H2 (second 6 months) when now = Oct 15 2026, anniv = Mar 1", () => {
    const now = new Date(2026, 9, 15);
    const anniversaryDate = new Date(2025, 2, 1);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "anniversary", now, undefined, anniversaryDate);
    expect(periodStart).toEqual(new Date(2026, 8, 1));
    expect(periodEnd).toEqual(new Date(2027, 1, 28, 23, 59, 59, 999));
  });

  it("anniversary: year-crossing — now = Feb 1 2026 (pre-anniv), anniv = Mar 1 2025 → H2 of 2025 cycle", () => {
    const now = new Date(2026, 1, 1);
    const anniversaryDate = new Date(2025, 2, 1);
    const { periodStart, periodEnd } = calculatePeriodBoundary("semiannual", "anniversary", now, undefined, anniversaryDate);
    expect(periodStart).toEqual(new Date(2025, 8, 1));
    expect(periodEnd).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
  });
});

describe("calculatePeriodBoundary — error cases", () => {
  it("throws when statementDay is missing for statement anchor", () => {
    expect(() => calculatePeriodBoundary("monthly", "statement", new Date(2026, 3, 15)))
      .toThrow("statementDay required for statement anchor");
  });

  it("throws when anniversaryDate is missing for anniversary anchor", () => {
    expect(() => calculatePeriodBoundary("annual", "anniversary", new Date(2026, 3, 15)))
      .toThrow("anniversaryDate required for anniversary anchor");
  });

  it("throws for unsupported resetPeriod and resetAnchor combination", () => {
    expect(() => calculatePeriodBoundary("biweekly", "custom", new Date(2026, 3, 15)))
      .toThrow('unsupported resetPeriod="biweekly" resetAnchor="custom"');
  });
});
