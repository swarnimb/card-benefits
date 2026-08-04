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

  it("counts only rows that still have unredeemed value", () => {
    // Pre-refetch optimistic state: n1 was just dragged to full, so it stays in
    // needsAttention with unusedAmount 0. The counts must already read 1, not 2 —
    // otherwise the hero claims more credits at risk than there are.
    const needsAttention = [
      makeBenefit({ benefitId: "n1", issuer: "Amex", unusedAmount: 0, cardId: "c1" }),
      makeBenefit({ benefitId: "n2", issuer: "Chase", unusedAmount: 52, cardId: "c2" }),
    ];
    render(
      <MoneyAtRiskHero
        moneyAtRisk={{ totalUnredeemed: 52, soonestDaysUntilReset: 4 }}
        needsAttention={needsAttention}
        sparkbar={[]}
      />,
    );
    expect(screen.getByText("1 actions needed")).toBeDefined();
    expect(screen.getByText(/1 credits across 1 cards/)).toBeDefined();
    expect(screen.getByText("$52 Chase")).toBeDefined();
  });

  it("falls back to the calm state once every at-risk row is settled", () => {
    // Every row completed but not yet re-bucketed — the hero must go calm rather
    // than render "0 credits across 0 cards".
    render(
      <MoneyAtRiskHero
        moneyAtRisk={{ totalUnredeemed: 0, soonestDaysUntilReset: 4 }}
        needsAttention={[makeBenefit({ benefitId: "n1", unusedAmount: 0 })]}
        sparkbar={[]}
      />,
    );
    expect(screen.getByText(/Nothing at risk/i)).toBeDefined();
    expect(screen.queryByText(/actions needed/i)).toBeNull();
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
  it("is collapsed by default: header + summary shown, rows hidden until expand", () => {
    render(
      <ExpiringSection
        items={[
          makeBenefit({ benefitId: "e1", benefitName: "Travel Credit", unusedAmount: 200, daysUntilReset: 3 }),
        ]}
        onUsageUpdate={vi.fn()}
      />,
    );
    // Header + collapsed summary (count + total at risk) are always visible.
    expect(screen.getByText("Expiring soon")).toBeDefined();
    expect(screen.getByText(/· 1 · \$200 at risk/)).toBeDefined();
    // Row detail is hidden while collapsed.
    expect(screen.queryByText("Travel Credit")).toBeNull();
    expect(screen.queryByText("3d left")).toBeNull();

    // Expanding reveals the rows.
    fireEvent.click(screen.getByRole("button", { name: /Expiring soon/i }));
    expect(screen.getByText("Travel Credit")).toBeDefined();
    expect(screen.getByText("$200")).toBeDefined();
    expect(screen.getByText("3d left")).toBeDefined();
  });

  it("renders nothing when empty", () => {
    const { container } = render(<ExpiringSection items={[]} onUsageUpdate={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("drops a just-completed row from the count but keeps it in the list", () => {
    // The optimistic update recomputes amounts without re-bucketing, so a fully
    // used credit is still in needsAttention until the next refetch. It must not
    // be counted as at risk — but it stays visible so the user sees it settle.
    render(
      <ExpiringSection
        items={[
          makeBenefit({ benefitId: "e1", benefitName: "Uber Cash", unusedAmount: 0, usedAmount: 15, value: 15 }),
          makeBenefit({ benefitId: "e2", benefitName: "Equinox Credit", unusedAmount: 25, value: 25 }),
        ]}
        onUsageUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText(/· 1 · \$25 at risk/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Expiring soon/i }));
    expect(screen.getByText("Uber Cash")).toBeDefined();
  });

  it("reveals an inline usage control when an expanded row is tapped", () => {
    render(
      <ExpiringSection
        items={[makeBenefit({ benefitId: "e9", benefitName: "Dining Credit", type: "credit" })]}
        onUsageUpdate={vi.fn()}
      />,
    );
    // Expand the section, then the row — the control only mounts once the row opens.
    fireEvent.click(screen.getByRole("button", { name: /Expiring soon/i }));
    expect(screen.queryByTestId("usage-slider-e9")).toBeNull();
    fireEvent.click(screen.getByText("Dining Credit").closest("button") as HTMLElement);
    expect(screen.getByTestId("usage-slider-e9")).toBeDefined();
  });
});

describe("CategorySection", () => {
  it("renders category headers; all groups collapsed by default, expand on tap", () => {
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
    // collapsed by default -> no detail row visible until a group is tapped
    expect(screen.queryByText("Airline Fee Credit")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Travel/i }));
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
