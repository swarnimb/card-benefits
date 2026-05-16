import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BenefitList } from "@/components/cards/benefit-list";
import { BenefitItem } from "@/components/cards/benefit-item";
import type { BenefitWithPeriod } from "@/types/benefit";

afterEach(() => cleanup());

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function makeBenefit(overrides: Partial<BenefitWithPeriod> = {}): BenefitWithPeriod {
  return {
    id: "b-1",
    userCardId: "card-1",
    name: "Travel Credit",
    description: null,
    type: "credit",
    value: 300,
    valueUnit: "dollars",
    resetPeriod: "annual",
    resetAnchor: "calendar",
    category: "travel",
    classification: "discretionary-credit",
    tracked: true,
    createdAt: new Date(),
    currentPeriod: null,
    ...overrides,
  };
}

describe("BenefitList", () => {
  it("omits group header for type not present in benefits", () => {
    const benefits = [
      makeBenefit({ id: "b-1", type: "credit", name: "Travel Credit" }),
    ];

    render(
      <BenefitList
        benefits={benefits}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );

    expect(screen.getByText("$Credits")).toBeDefined();
    expect(screen.queryByText("Subscriptions")).toBeNull();
    expect(screen.queryByText("Access")).toBeNull();
    expect(screen.queryByText("One-time Perks")).toBeNull();
  });
});

describe("BenefitItem", () => {
  it("renders UsageSlider for credit type", () => {
    render(
      <BenefitItem
        benefit={makeBenefit({ id: "b-1", type: "credit" })}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );

    expect(screen.getByTestId("usage-slider-b-1")).toBeDefined();
  });

  it("renders UsageToggle for subscription type", () => {
    render(
      <BenefitItem
        benefit={makeBenefit({ id: "b-2", type: "subscription", value: null })}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );

    expect(screen.getByTestId("usage-toggle-b-2")).toBeDefined();
  });

  it("shows expiring label with correct day count", () => {
    const periodEnd = new Date(Date.now() + 3 * MS_PER_DAY);

    render(
      <BenefitItem
        benefit={makeBenefit({
          id: "b-3",
          type: "credit",
          currentPeriod: {
            id: "period-1",
            periodStart: new Date(),
            periodEnd,
            usedAmount: 0,
            status: "open",
          },
        })}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );

    expect(screen.getByText("⚠ Resets in 3 days")).toBeDefined();
  });
});
