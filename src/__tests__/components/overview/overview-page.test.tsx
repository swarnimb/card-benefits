import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import type { OverviewData, OverviewBenefit, CategoryGroup } from "@/types/api";

afterEach(() => cleanup());

vi.mock("framer-motion", () => import("./_mock-framer-motion"));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import OverviewPage from "@/app/(app)/overview/page";

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
    daysUntilReset: 5,
    cardId: "uc1",
    value: 50,
    usedAmount: 0,
    resetPeriod: "monthly",
    setAndForget: false,
    ...overrides,
  };
}

function makeGroup(group: CategoryGroup["group"], credits: OverviewBenefit[]): CategoryGroup {
  return {
    group,
    credits,
    totalRemaining: credits.reduce((s, c) => s + c.unusedAmount, 0),
    totalUsed: credits.reduce((s, c) => s + c.usedAmount, 0),
    totalValue: credits.reduce((s, c) => s + (c.value ?? 0), 0),
    creditCount: credits.length,
    cardCount: new Set(credits.map((c) => c.cardId)).size,
  };
}

const emptyData: OverviewData = {
  moneyAtRisk: { totalUnredeemed: 0, soonestDaysUntilReset: null },
  needsAttention: [],
  onTrack: [],
  done: [],
  activeByCategory: [],
  sparkbar: [],
};

function makeFetchOk(data: OverviewData) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => data } as unknown as Response);
}

describe("OverviewPage", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("renders hero + groups from mock OverviewData", async () => {
    const travel = makeRow({ benefitId: "t1", benefitName: "Airline Credit", category: "travel", daysUntilReset: 90, cardId: "uc2" });
    const dining = makeRow({ benefitId: "t2", benefitName: "Restaurant Credit", category: "dining", daysUntilReset: 80 });
    const data: OverviewData = {
      moneyAtRisk: { totalUnredeemed: 200, soonestDaysUntilReset: 5 },
      needsAttention: [makeRow({ benefitId: "n1", benefitName: "Urgent Dining", unusedAmount: 200 })],
      onTrack: [travel, dining],
      done: [
        makeRow({ benefitId: "d1", benefitName: "Used Streaming", value: 20, unusedAmount: 0, usedAmount: 20 }),
        makeRow({ benefitId: "d2", benefitName: "Lounge Access", value: null, unusedAmount: 0 }),
      ],
      activeByCategory: [makeGroup("Travel", [travel]), makeGroup("Dining", [dining])],
      sparkbar: [{ benefitId: "n1", issuerColor: "#C9A84C", weight: 1, remaining: 200 }],
    };
    vi.mocked(fetch).mockImplementation(makeFetchOk(data));

    render(<OverviewPage />);

    await waitFor(() => expect(screen.getByText("Money at risk")).toBeDefined());

    // expiring section is collapsed by default — its summary shows count + total
    // at risk (same $ figure the hero sums), and the row is hidden until expand.
    expect(screen.getByText(/· 1 · \$200 at risk/)).toBeDefined();
    expect(screen.queryByText("Urgent Dining")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Expiring soon/i }));
    expect(screen.getByText("Urgent Dining")).toBeDefined();
    // category group headers
    expect(screen.getByText("Active credits")).toBeDefined();
    expect(screen.getByText("Travel")).toBeDefined();
    expect(screen.getByText("Dining")).toBeDefined();
    // settled header reflects the value-split (1 used, 1 nothing to do)
    expect(screen.getByText(/1 used, 1 nothing to do/i)).toBeDefined();
  });

  it("empty state renders when no tracked benefits", async () => {
    vi.mocked(fetch).mockImplementation(makeFetchOk(emptyData));

    render(<OverviewPage />);

    await waitFor(() =>
      expect(screen.getByText(/no tracked benefits yet/i)).toBeDefined()
    );
    const adminLink = screen.getByRole("link", { name: /add a card in admin/i });
    expect((adminLink as HTMLAnchorElement).href).toContain("/admin");
  });

  it("renders error state with retry when API fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as unknown as Response);

    render(<OverviewPage />);

    await waitFor(() =>
      expect(screen.getByText(/could not load overview/i)).toBeDefined()
    );
    const retry = screen.getByRole("button", { name: /retry/i });
    expect(retry).toBeDefined();
    // Retry re-fetches — succeed the second time.
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyData,
    } as unknown as Response);
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByText(/no tracked benefits yet/i)).toBeDefined()
    );
  });

  it("does not render any tracked=false benefit row", async () => {
    // The API contract excludes tracked=false from every bucket; the page must
    // render only what the buckets contain — nothing more.
    const credit = makeRow({ benefitId: "v1", benefitName: "Visible Tracked Credit", category: "dining", daysUntilReset: 60 });
    const data: OverviewData = {
      moneyAtRisk: { totalUnredeemed: 0, soonestDaysUntilReset: null },
      needsAttention: [],
      onTrack: [credit],
      done: [],
      activeByCategory: [makeGroup("Dining", [credit])],
      sparkbar: [],
    };
    vi.mocked(fetch).mockImplementation(makeFetchOk(data));

    render(<OverviewPage />);

    // Categories are collapsed by default — expand the group to reveal its rows.
    await waitFor(() => expect(screen.getByText("Dining")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    expect(screen.getByText("Visible Tracked Credit")).toBeDefined();
    expect(screen.queryByText("Excluded Auto-Earn Perk")).toBeNull();
  });
});
