import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type {
  OverviewBenefit,
  CategoryGroup,
  SparkbarSegment,
} from "@/types/api";

afterEach(() => cleanup());

vi.mock("framer-motion", () => import("./_mock-framer-motion"));

import { MoneyAtRiskHero } from "@/components/overview/money-at-risk-hero";
import { ExpiringSection } from "@/components/overview/expiring-section";
import { CategorySection } from "@/components/overview/category-section";
import { SettledSection } from "@/components/overview/settled-section";

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
    setAndForget: false,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<CategoryGroup> = {}): CategoryGroup {
  const credits = overrides.credits ?? [makeBenefit()];
  return {
    group: "Dining",
    credits,
    totalRemaining: credits.reduce((s, c) => s + c.unusedAmount, 0),
    totalUsed: credits.reduce((s, c) => s + c.usedAmount, 0),
    totalValue: credits.reduce((s, c) => s + (c.value ?? 0), 0),
    creditCount: credits.length,
    cardCount: new Set(credits.map((c) => c.cardId)).size,
    ...overrides,
  };
}

describe("MoneyAtRiskHero", () => {
  it("renders at-risk total, time frame, sparkbar footnote when value at risk", () => {
    const needsAttention = [
      makeBenefit({ benefitId: "n1", issuer: "Amex", unusedAmount: 300, cardId: "c1" }),
      makeBenefit({ benefitId: "n2", issuer: "Chase", unusedAmount: 52, cardId: "c2" }),
    ];
    const sparkbar: SparkbarSegment[] = needsAttention.map((c) => ({
      benefitId: c.benefitId,
      issuerColor: c.cardColor,
      weight: c.unusedAmount / 352,
      remaining: c.unusedAmount,
    }));
    render(
      <MoneyAtRiskHero
        moneyAtRisk={{ totalUnredeemed: 352, soonestDaysUntilReset: 12 }}
        needsAttention={needsAttention}
        sparkbar={sparkbar}
      />,
    );
    expect(screen.getByText("Money at risk")).toBeDefined();
    expect(screen.getByText("$352")).toBeDefined();
    expect(screen.getByText("12 days")).toBeDefined();
    // top issuer by summed at-risk dollars is Amex ($300), not the mock's hardcode
    expect(screen.getByText("$300 Amex")).toBeDefined();
    expect(screen.getByText("2 actions needed")).toBeDefined();
  });

  it("renders calm state with no sparkbar/footnote when nothing at risk", () => {
    render(
      <MoneyAtRiskHero
        moneyAtRisk={{ totalUnredeemed: 0, soonestDaysUntilReset: null }}
        needsAttention={[]}
        sparkbar={[]}
      />,
    );
    expect(screen.getByText("$0")).toBeDefined();
    expect(screen.getByText(/Nothing at risk/i)).toBeDefined();
    expect(screen.queryByText(/Resets in/i)).toBeNull();
    expect(screen.queryByText(/actions needed/i)).toBeNull();
  });
});

describe("ExpiringSection", () => {
  it("renders rows from needsAttention with remaining + days", () => {
    render(
      <ExpiringSection
        items={[
          makeBenefit({ benefitId: "e1", benefitName: "Travel Credit", unusedAmount: 200, daysUntilReset: 3 }),
        ]}
      />,
    );
    expect(screen.getByText("Expiring soon")).toBeDefined();
    expect(screen.getByText("Travel Credit")).toBeDefined();
    expect(screen.getByText("$200")).toBeDefined();
    expect(screen.getByText("3d left")).toBeDefined();
  });

  it("renders nothing when empty", () => {
    const { container } = render(<ExpiringSection items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("CategorySection", () => {
  it("renders category headers; first group open by default", () => {
    render(
      <CategorySection
        groups={[
          makeGroup({
            group: "Travel",
            credits: [makeBenefit({ benefitId: "t1", benefitName: "Airline Fee Credit", category: "travel" })],
          }),
          makeGroup({
            group: "Dining",
            credits: [makeBenefit({ benefitId: "d1", benefitName: "Restaurant Credit" })],
          }),
        ]}
        onUsageUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("Active credits")).toBeDefined();
    expect(screen.getByText("Travel")).toBeDefined();
    expect(screen.getByText("Dining")).toBeDefined();
    // first group open -> its detail row name is visible
    expect(screen.getByText("Airline Fee Credit")).toBeDefined();
  });

  it("renders nothing when empty", () => {
    const { container } = render(<CategorySection groups={[]} onUsageUpdate={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SettledSection", () => {
  it("renders collapsed by default and splits used vs nothing-to-do on expand", () => {
    render(
      <SettledSection
        done={[
          makeBenefit({ benefitId: "u1", benefitName: "Used Travel Credit", value: 100, unusedAmount: 0, usedAmount: 100 }),
          makeBenefit({ benefitId: "p1", benefitName: "Lounge Access", value: null, unusedAmount: 0 }),
        ]}
      />,
    );
    expect(screen.getByText(/1 used, 1 nothing to do/i)).toBeDefined();
    expect(screen.queryByText("Used Travel Credit")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Settled/i }));
    expect(screen.getByText("Used Travel Credit")).toBeDefined();
    expect(screen.getByText("Lounge Access")).toBeDefined();
    expect(screen.getByText("Fully used")).toBeDefined();
    expect(screen.getByText("Nothing to do")).toBeDefined();
  });

  it("renders nothing when empty", () => {
    const { container } = render(<SettledSection done={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
