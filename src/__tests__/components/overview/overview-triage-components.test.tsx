import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { OverviewBenefit } from "@/types/api";

afterEach(() => cleanup());

vi.mock("framer-motion", () => import("./_mock-framer-motion"));

import { MoneyAtRiskHero } from "@/components/overview/money-at-risk-hero";
import { UrgencySection } from "@/components/overview/urgency-section";
import { OverviewBenefitRow } from "@/components/overview/overview-benefit-row";

function makeBenefit(overrides: Partial<OverviewBenefit> = {}): OverviewBenefit {
  return {
    benefitId: "b1",
    benefitName: "Dining Credit",
    cardName: "Sapphire Reserve",
    issuer: "Chase",
    cardColor: "#117ACA",
    type: "credit",
    category: "dining",
    unusedAmount: 50,
    daysUntilReset: 4,
    cardId: "uc1",
    value: 50,
    usedAmount: 0,
    resetPeriod: "monthly",
    ...overrides,
  };
}

describe("MoneyAtRiskHero", () => {
  it("renders at-risk total and time frame when value at risk", () => {
    render(<MoneyAtRiskHero totalUnredeemed={352} soonestDaysUntilReset={12} />);
    expect(screen.getByText("Money at risk")).toBeDefined();
    expect(screen.getByText("$352")).toBeDefined();
    expect(screen.getByText("12 days")).toBeDefined();
  });

  it("renders calm/positive state when nothing at risk", () => {
    render(<MoneyAtRiskHero totalUnredeemed={0} soonestDaysUntilReset={null} />);
    expect(screen.getByText("$0")).toBeDefined();
    expect(screen.getByText(/Nothing at risk/i)).toBeDefined();
    expect(screen.queryByText(/Resets in/i)).toBeNull();
  });
});

describe("UrgencySection", () => {
  it("renders Done collapsed by default and expands on activation", () => {
    render(
      <UrgencySection
        title="Done"
        tone="settled"
        defaultCollapsed
        benefits={[makeBenefit({ benefitId: "d1", benefitName: "Used Travel Credit" })]}
      />,
    );

    expect(screen.queryByText("Used Travel Credit")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Done/i }));
    expect(screen.getByText("Used Travel Credit")).toBeDefined();
  });

  it("renders nothing for Needs attention when list empty", () => {
    const { container } = render(
      <UrgencySection title="Needs attention" tone="attention" benefits={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("OverviewBenefitRow", () => {
  it("renders type/category/card as row metadata and truncates long name", () => {
    const longName =
      "Extremely Long Benefit Name That Should Be Truncated With An Ellipsis Instead Of Wrapping";
    render(
      <OverviewBenefitRow
        benefit={makeBenefit({
          benefitName: longName,
          type: "subscription",
          category: "streaming",
          cardName: "Platinum",
          issuer: "Amex",
        })}
      />,
    );

    const nameEl = screen.getByText(longName);
    expect(nameEl).toBeDefined();
    expect(nameEl.className).toContain("truncate");
    expect(screen.getByText("Amex")).toBeDefined();
    expect(screen.getByText("Platinum")).toBeDefined();
    expect(screen.getByText("subscription")).toBeDefined();
    expect(screen.getByText("streaming")).toBeDefined();
  });
});
