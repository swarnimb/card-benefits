import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { OverviewBenefit } from "@/types/api";

afterEach(() => cleanup());

vi.mock("framer-motion", () => import("./_mock-framer-motion"));

import { CategoryDetailRow } from "@/components/overview/category-detail-row";
import { OV } from "@/components/overview/tokens";

/** Normalizes a hex color the way jsdom stores it on .style.color, so assertions are robust. */
function normColor(hex: string): string {
  const el = document.createElement("span");
  el.style.color = hex;
  return el.style.color;
}

function makeRow(overrides: Partial<OverviewBenefit> = {}): OverviewBenefit {
  return {
    benefitId: "b1",
    benefitName: "Dining Credit",
    cardName: "Amex Gold",
    issuer: "Amex",
    cardColor: "#C9A84C",
    type: "credit",
    category: "dining",
    unusedAmount: 50,
    daysUntilReset: 20,
    cardId: "uc1",
    value: 50,
    usedAmount: 0,
    resetPeriod: "monthly",
    setAndForget: false,
    ...overrides,
  };
}

/** CategoryDetailRow is controlled — this harness owns the expand state, flipped via onToggle. */
function Harness({ c }: { c: OverviewBenefit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <CategoryDetailRow
      c={c}
      last
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      onUsageUpdate={vi.fn()}
    />
  );
}

function rowButton(name: string): HTMLElement {
  return screen.getByText(name).closest("button") as HTMLElement;
}

describe("CategoryDetailRow", () => {
  it("reveals UsageSlider for a credit when tapped", () => {
    render(<Harness c={makeRow({ benefitId: "b1", type: "credit" })} />);

    expect(screen.queryByTestId("usage-slider-b1")).toBeNull();
    fireEvent.click(rowButton("Dining Credit"));
    expect(screen.getByTestId("usage-slider-b1")).toBeDefined();
  });

  it("reveals UsageToggle for a subscription when tapped", () => {
    render(
      <Harness
        c={makeRow({
          benefitId: "b2",
          benefitName: "Walmart+ Membership",
          type: "subscription",
        })}
      />,
    );

    expect(screen.queryByTestId("usage-toggle-b2")).toBeNull();
    fireEvent.click(rowButton("Walmart+ Membership"));
    expect(screen.getByTestId("usage-toggle-b2")).toBeDefined();
  });

  it("collapses when tapped again", () => {
    render(<Harness c={makeRow({ benefitId: "b1", type: "credit" })} />);

    const button = rowButton("Dining Credit");
    fireEvent.click(button);
    expect(screen.getByTestId("usage-slider-b1")).toBeDefined();

    fireEvent.click(button);
    expect(screen.queryByTestId("usage-slider-b1")).toBeNull();
  });

  it("offers no usage control for a set-and-forget benefit (CONSTRAINT-17)", () => {
    render(
      <Harness
        c={makeRow({
          benefitId: "saf",
          benefitName: "Airport Lounge Membership",
          type: "subscription",
          setAndForget: true,
        })}
      />,
    );

    const button = rowButton("Airport Lounge Membership");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByTestId("usage-toggle-saf")).toBeNull();
  });

  it("shows days-left in muted style when not urgent", () => {
    render(<Harness c={makeRow({ benefitId: "m1", daysUntilReset: 20 })} />);

    const days = screen.getByTestId("days-left-m1");
    expect(days.textContent).toContain("20d");
    expect(days.style.color).toBe(normColor(OV.text3));
    expect(days.style.color).not.toBe(normColor(OV.amber));
  });

  it("shows days-left in amber when urgent", () => {
    render(<Harness c={makeRow({ benefitId: "u1", daysUntilReset: 2 })} />);

    const days = screen.getByTestId("days-left-u1");
    expect(days.textContent).toContain("2d");
    expect(days.style.color).toBe(normColor(OV.amber));
  });

  it("shows no days value when daysUntilReset is null", () => {
    render(
      <Harness
        c={makeRow({ benefitId: "n1", daysUntilReset: null, resetPeriod: "once", value: null })}
      />,
    );

    expect(screen.queryByTestId("days-left-n1")).toBeNull();
  });
});
