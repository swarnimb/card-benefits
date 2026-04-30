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
