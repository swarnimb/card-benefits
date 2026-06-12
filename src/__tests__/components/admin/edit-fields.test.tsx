import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { annualRollup, BenefitAmount } from "@/components/admin/edit-fields";

afterEach(() => cleanup());

describe("annualRollup", () => {
  it("returns 400 for quarterly $100", () => {
    expect(annualRollup(100, "quarterly")).toBe(400);
  });

  it("returns 300 for monthly $25", () => {
    expect(annualRollup(25, "monthly")).toBe(300);
  });

  it("returns 600 for semiannual $300", () => {
    expect(annualRollup(300, "semiannual")).toBe(600);
  });

  it("returns null for annual and for once", () => {
    expect(annualRollup(300, "annual")).toBeNull();
    expect(annualRollup(300, "once")).toBeNull();
  });

  it("returns null for a missing or non-positive value", () => {
    expect(annualRollup(null, "monthly")).toBeNull();
    expect(annualRollup(0, "monthly")).toBeNull();
  });
});

describe("BenefitAmount", () => {
  it('renders the "$400/yr" roll-up for a quarterly $100 benefit', () => {
    render(<BenefitAmount value={100} resetPeriod="quarterly" />);
    expect(screen.getByText("per quarter")).toBeDefined();
    expect(screen.getByText(/\$400\/yr/)).toBeDefined();
  });

  it("hides the roll-up for an annual benefit", () => {
    render(<BenefitAmount value={300} resetPeriod="annual" />);
    expect(screen.queryByText(/\/yr/)).toBeNull();
  });
});
