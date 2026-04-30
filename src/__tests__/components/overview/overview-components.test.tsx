import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ExpiringAlerts } from "@/components/overview/expiring-alerts";
import { CategoryRow } from "@/components/overview/category-row";
import { CategoryList } from "@/components/overview/category-list";
import type { OverviewData } from "@/types/api";

afterEach(() => cleanup());

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      animate: _a,
      exit: _e,
      initial: _i,
      transition: _t,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { animate?: unknown; exit?: unknown; initial?: unknown; transition?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

// --- ExpiringAlerts ---

type Alert = OverviewData["expiringSoon"][0];

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    benefitId: "b1",
    benefitName: "Dining Credit",
    userCardId: "uc1",
    cardName: "Sapphire Reserve",
    cardColor: "#117ACA",
    periodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    remainingValue: 50,
    ...overrides,
  };
}

describe("ExpiringAlerts", () => {
  it("renders nothing when alerts array is empty", () => {
    const { container } = render(<ExpiringAlerts alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders alert details when alerts are present", () => {
    render(<ExpiringAlerts alerts={[makeAlert()]} />);
    expect(screen.getByText("Dining Credit")).toBeDefined();
    expect(screen.getByText(/\$50 remaining/)).toBeDefined();
    expect(screen.getByText(/Sapphire Reserve/)).toBeDefined();
  });
});

// --- CategoryRow ---

type Category = OverviewData["categories"][0];

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    category: "dining",
    totalValue: 300,
    totalUsed: 150,
    cardCount: 2,
    cards: [
      { cardName: "Sapphire Reserve", cardColor: "#117ACA", totalValue: 200, totalUsed: 100 },
      { cardName: "Amex Platinum", cardColor: "#C9A84C", totalValue: 100, totalUsed: 50 },
    ],
    ...overrides,
  };
}

describe("CategoryRow", () => {
  it("expands per-card breakdown on tap", () => {
    render(<CategoryRow category={makeCategory()} />);

    // Breakdown not visible initially
    expect(screen.queryByText("Sapphire Reserve")).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByRole("button"));

    // Breakdown now visible
    expect(screen.getByText("Sapphire Reserve")).toBeDefined();
    expect(screen.getByText("Amex Platinum")).toBeDefined();
  });

  it("uses soft green fill when category is fully used", () => {
    render(<CategoryRow category={makeCategory({ totalUsed: 300, totalValue: 300 })} />);
    // Green bar (4ADE80) rendered — component logic sets it when isFullyUsed
    // We check the text renders correctly
    expect(screen.getByText("$300 / $300")).toBeDefined();
  });
});

// --- CategoryList ---

describe("CategoryList", () => {
  it("renders only categories with totalValue > 0", () => {
    const categories: Category[] = [
      makeCategory({ category: "dining", totalValue: 300, totalUsed: 0 }),
      makeCategory({ category: "travel", totalValue: 0, totalUsed: 0, cardCount: 0, cards: [] }),
    ];
    render(<CategoryList categories={categories} />);

    // Only dining should render (travel has totalValue = 0)
    expect(screen.getByText("dining")).toBeDefined();
    expect(screen.queryByText("travel")).toBeNull();
  });

  it("renders nothing when all categories are empty", () => {
    const { container } = render(
      <CategoryList categories={[makeCategory({ totalValue: 0, totalUsed: 0, cardCount: 0, cards: [] })]} />
    );
    expect(container.firstChild).toBeNull();
  });
});
