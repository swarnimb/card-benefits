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
    setAndForget: false,
    activatedAt: null,
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

  it("pulls set-and-forget benefits into a separate 'Automatic' group, out of their type group", () => {
    const benefits = [
      makeBenefit({ id: "credit", type: "credit", name: "Travel Credit" }),
      makeBenefit({ id: "saf", type: "subscription", name: "Walmart+", setAndForget: true }),
    ];

    render(
      <BenefitList benefits={benefits} cardColor="#117ACA" onUsageUpdate={vi.fn()} />
    );

    expect(screen.getByText("Automatic")).toBeDefined();
    // The set-and-forget benefit is a subscription, but must NOT create a
    // "Subscriptions" type group — it lives only in the Automatic group.
    expect(screen.queryByText("Subscriptions")).toBeNull();
    expect(screen.getByTestId("activation-toggle-saf")).toBeDefined();
  });

  it("omits the 'Automatic' group when no set-and-forget benefits exist", () => {
    render(
      <BenefitList
        benefits={[makeBenefit({ id: "credit", type: "credit" })]}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );
    expect(screen.queryByText("Automatic")).toBeNull();
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

  it("renders ActivationToggle (not the per-type widget) for a set-and-forget benefit", () => {
    render(
      <BenefitItem
        benefit={makeBenefit({ id: "saf-1", type: "subscription", setAndForget: true, activatedAt: null })}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );

    expect(screen.getByTestId("activation-toggle-saf-1")).toBeDefined();
    // The per-type subscription widget must NOT render for a set-and-forget benefit.
    expect(screen.queryByTestId("usage-toggle-saf-1")).toBeNull();
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
