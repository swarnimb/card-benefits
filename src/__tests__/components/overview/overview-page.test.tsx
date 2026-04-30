import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import OverviewPage from "@/app/(app)/overview/page";
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
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      exit?: unknown;
      initial?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function makeFetchResolving(data: OverviewData) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as unknown as Response);
}

const emptyData: OverviewData = {
  categories: [],
  expiringSoon: [],
};

const populatedData: OverviewData = {
  categories: [
    {
      category: "Dining",
      totalValue: 120,
      totalUsed: 40,
      cardCount: 1,
      cards: [{ cardName: "Amex Gold", cardColor: "#C9A84C", totalValue: 120, totalUsed: 40 }],
    },
  ],
  expiringSoon: [
    {
      benefitId: "b1",
      benefitName: "Dining Credit",
      userCardId: "uc1",
      cardName: "Amex Gold",
      cardColor: "#C9A84C",
      periodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      remainingValue: 80,
    },
  ],
};

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders empty state when no categories returned", async () => {
    vi.mocked(fetch).mockImplementation(makeFetchResolving(emptyData));

    render(<OverviewPage />);

    await waitFor(() =>
      expect(screen.getByText(/no credit benefits tracked yet/i)).toBeDefined()
    );

    const adminLink = screen.getByRole("link", { name: /add a card in admin/i });
    expect((adminLink as HTMLAnchorElement).href).toContain("/admin");
  });

  it("renders ExpiringAlerts above CategoryList", async () => {
    vi.mocked(fetch).mockImplementation(makeFetchResolving(populatedData));

    render(<OverviewPage />);

    await waitFor(() =>
      expect(screen.getByText("Expiring Soon")).toBeDefined()
    );

    const expiring = screen.getByText("Expiring Soon");
    const category = screen.getByText("Dining");

    // ExpiringAlerts must appear before CategoryList in the DOM
    expect(
      expiring.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
