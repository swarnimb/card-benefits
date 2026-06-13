import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BenefitList } from "@/components/cards/benefit-list";
import { BenefitItem } from "@/components/cards/benefit-item";
import type { BenefitWithPeriod } from "@/types/benefit";

// BenefitList now uses Framer Motion (AnimatePresence) for the hidden-section
// expand. Mock it (project convention for component tests) so the collapsible
// content renders synchronously in jsdom.
vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

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
    source: "scraped",
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

  it("renders a card whose benefits are 100% set-and-forget without a blank panel", () => {
    // A card with only set-and-forget benefits must still render the Automatic
    // group and every benefit — not an empty/blank panel (Feature 8 edge case).
    const benefits = [
      makeBenefit({ id: "saf-a", type: "subscription", name: "Walmart+", setAndForget: true }),
      makeBenefit({ id: "saf-b", type: "perk", name: "CLEAR Plus", setAndForget: true }),
    ];

    render(
      <BenefitList benefits={benefits} cardColor="#117ACA" onUsageUpdate={vi.fn()} />
    );

    expect(screen.getByText("Automatic")).toBeDefined();
    expect(screen.getByText("Walmart+")).toBeDefined();
    expect(screen.getByText("CLEAR Plus")).toBeDefined();
    expect(screen.getByTestId("activation-toggle-saf-a")).toBeDefined();
    expect(screen.getByTestId("activation-toggle-saf-b")).toBeDefined();
    // No per-type group headers — everything lives only in the Automatic group.
    expect(screen.queryByText("Subscriptions")).toBeNull();
    expect(screen.queryByText("One-time Perks")).toBeNull();
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

  it("renders only tracked benefits in the main list", () => {
    const benefits = [
      makeBenefit({ id: "shown", type: "credit", name: "Travel Credit", tracked: true }),
      makeBenefit({ id: "hidden", type: "subscription", name: "Excluded Sub", tracked: false }),
    ];

    render(
      <BenefitList benefits={benefits} cardColor="#117ACA" onUsageUpdate={vi.fn()} />
    );

    // Tracked benefit + its type group are in the main list.
    expect(screen.getByText("Travel Credit")).toBeDefined();
    expect(screen.getByText("$Credits")).toBeDefined();

    // Untracked benefit must NOT create a "Subscriptions" type group and its
    // row is hidden until the section is expanded.
    expect(screen.queryByText("Subscriptions")).toBeNull();
    expect(screen.queryByText("Excluded Sub")).toBeNull();
  });

  it("collapses untracked benefits into a hidden section that expands on tap", () => {
    const benefits = [
      makeBenefit({ id: "shown", type: "credit", name: "Travel Credit", tracked: true }),
      makeBenefit({ id: "h1", type: "subscription", name: "Excluded Sub", tracked: false }),
      makeBenefit({ id: "h2", type: "perk", name: "Excluded Perk", tracked: false }),
    ];

    render(
      <BenefitList benefits={benefits} cardColor="#117ACA" onUsageUpdate={vi.fn()} />
    );

    // Collapsed: a single summary row reflects the count, rows are not shown.
    const toggle = screen.getByTestId("hidden-benefits-toggle");
    expect(toggle.textContent).toMatch(/2 hidden/i);
    expect(screen.queryByText("Excluded Sub")).toBeNull();
    expect(screen.queryByText("Excluded Perk")).toBeNull();

    // Expand on tap: both untracked rows (with their eye toggles) appear.
    fireEvent.click(toggle);
    expect(screen.getByText("Excluded Sub")).toBeDefined();
    expect(screen.getByText("Excluded Perk")).toBeDefined();
    expect(screen.getByTestId("tracked-toggle-h1")).toBeDefined();
    expect(screen.getByTestId("tracked-toggle-h2")).toBeDefined();
  });

  it("omits the hidden row when all benefits are tracked", () => {
    render(
      <BenefitList
        benefits={[makeBenefit({ id: "shown", type: "credit", tracked: true })]}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
      />
    );

    // No "N hidden" summary row at all (not "0 hidden").
    expect(screen.queryByTestId("hidden-benefits-toggle")).toBeNull();
    expect(screen.queryByText(/hidden/i)).toBeNull();
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
