import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import CardsPage from "@/app/(app)/cards/page";
import type { UserCardWithBenefits } from "@/types/card";
import type { BenefitWithPeriod } from "@/types/benefit";
import type { PortfolioStats } from "@/types/api";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

// Mock the cards data hook — tests inject cards directly.
vi.mock("@/hooks/use-cards-data", () => ({
  useCardsData: vi.fn(),
}));

// Reuse the shared overview framer-motion mock (passes children + props through).
vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
  Eye: () => <svg data-testid="eye" />,
  EyeOff: () => <svg data-testid="eye-off" />,
}));

import { useCardsData } from "@/hooks/use-cards-data";
const mockUseCardsData = vi.mocked(useCardsData);

const PORTFOLIO: PortfolioStats = {
  annualFeeTotal: 1245,
  redeemedYtd: 430,
  available: 815,
};

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
    currentPeriod: {
      id: "p-1",
      periodStart: new Date(),
      periodEnd: null,
      usedAmount: 0,
      status: "open",
    },
    ...overrides,
  };
}

function makeCard(overrides: Partial<UserCardWithBenefits> = {}): UserCardWithBenefits {
  return {
    id: "card-1",
    userId: "user_test",
    cardId: "catalog-1",
    displayOrder: 0,
    lastVerifiedAt: null,
    statementDay: null,
    anniversaryDate: null,
    createdAt: new Date(),
    card: {
      id: "catalog-1",
      issuer: "Chase",
      name: "Sapphire Reserve",
      scrapeUrl: null,
      defaultColor: "#3B5BDB",
      annualFee: 550,
    },
    benefits: [makeBenefit()],
    ...overrides,
  };
}

function mockCards(cards: UserCardWithBenefits[]) {
  mockUseCardsData.mockReturnValue({
    cards,
    loading: false,
    error: null,
    retry: vi.fn(),
    updateBenefitUsage: vi.fn().mockResolvedValue(undefined),
    syncBenefitTracked: vi.fn(),
    syncBenefitActivation: vi.fn(),
  });
}

function stubPortfolioFetch(stats: PortfolioStats = PORTFOLIO) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => stats })
  );
}

describe("Cards portfolio + stack", () => {
  it("renders portfolio stats + stack from mock", async () => {
    stubPortfolioFetch();
    mockCards([
      makeCard({ id: "card-1" }),
      makeCard({
        id: "card-2",
        card: {
          id: "catalog-2",
          issuer: "Amex",
          name: "Platinum",
          scrapeUrl: null,
          defaultColor: "#C9A961",
          annualFee: 695,
        },
        benefits: [makeBenefit({ id: "b-2", userCardId: "card-2" })],
      }),
    ]);

    render(<CardsPage />);

    // Eyebrow: 2 cards, 2 distinct issuers (Chase + Amex).
    expect(screen.getByText("2 cards · 2 issuers")).toBeDefined();

    // Portfolio trio values land after the fetch resolves.
    await waitFor(() => expect(screen.getByText("$1,245")).toBeDefined());
    expect(screen.getByText("$430")).toBeDefined();
    expect(screen.getByText("$815")).toBeDefined();

    // Card faces: issuer, product name, benefit count.
    expect(screen.getByText("Chase")).toBeDefined();
    expect(screen.getByText("Sapphire Reserve")).toBeDefined();
    expect(screen.getByText("Amex")).toBeDefined();
    expect(screen.getByText("Platinum")).toBeDefined();
    expect(screen.getAllByText("1 benefit").length).toBe(2);
  });

  it("annualFee null renders — in the detail Annual stat", async () => {
    stubPortfolioFetch();
    mockCards([
      makeCard({
        id: "card-1",
        card: {
          id: "catalog-1",
          issuer: "Chase",
          name: "Freedom Flex",
          scrapeUrl: null,
          defaultColor: "#3B5BDB",
          annualFee: null,
        },
      }),
    ]);

    render(<CardsPage />);

    // Expand the card to reveal the detail stat trio.
    fireEvent.click(screen.getByLabelText("Chase Freedom Flex"));

    // Detail "Annual" label is present and its value is an em-dash.
    // ("Annual" is unique to the detail trio — the portfolio trio says
    // "Annual fees" / "Redeemed YTD", so exact-text matching disambiguates.)
    await waitFor(() => expect(screen.getByText("Annual")).toBeDefined());
    expect(screen.getByText("—")).toBeDefined();
    // "Redeemed" is unique to the detail trio; "Available" appears in both
    // trios (portfolio + detail), so assert at least one is present.
    expect(screen.getByText("Redeemed")).toBeDefined();
    expect(screen.getAllByText("Available").length).toBeGreaterThanOrEqual(1);
  });
});
