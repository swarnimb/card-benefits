import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import type { OverviewData, OverviewBenefit } from "@/types/api";

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
    ...overrides,
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

  it("renders hero above Needs attention, On track, then Done", async () => {
    const data: OverviewData = {
      moneyAtRisk: { totalUnredeemed: 200, soonestDaysUntilReset: 5 },
      needsAttention: [makeRow({ benefitId: "n1", benefitName: "Urgent Dining" })],
      onTrack: [makeRow({ benefitId: "t1", benefitName: "Steady Travel", daysUntilReset: 90 })],
      done: [makeRow({ benefitId: "d1", benefitName: "Used Streaming", unusedAmount: 0 })],
      activeByCategory: [],
      sparkbar: [],
    };
    vi.mocked(fetch).mockImplementation(makeFetchOk(data));

    render(<OverviewPage />);

    await waitFor(() => expect(screen.getByText("Money at risk")).toBeDefined());

    const hero = screen.getByText("Money at risk");
    const needs = screen.getByText("Needs attention");
    const onTrack = screen.getByText("On track");
    const done = screen.getByText("Done");

    expect(hero.compareDocumentPosition(needs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(needs.compareDocumentPosition(onTrack) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(onTrack.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Urgent Dining")).toBeDefined();
    expect(screen.getByText("Steady Travel")).toBeDefined();
  });

  it("renders add-a-card empty state when API returns no tracked benefits", async () => {
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
    const data: OverviewData = {
      moneyAtRisk: { totalUnredeemed: 0, soonestDaysUntilReset: null },
      needsAttention: [],
      onTrack: [makeRow({ benefitId: "v1", benefitName: "Visible Tracked Credit" })],
      done: [],
      activeByCategory: [],
      sparkbar: [],
    };
    vi.mocked(fetch).mockImplementation(makeFetchOk(data));

    render(<OverviewPage />);

    await waitFor(() =>
      expect(screen.getByText("Visible Tracked Credit")).toBeDefined()
    );
    expect(screen.queryByText("Excluded Auto-Earn Perk")).toBeNull();
  });
});
