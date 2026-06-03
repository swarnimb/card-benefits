import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CardsPage from "@/app/(app)/cards/page";

afterEach(() => cleanup());

// Mock the data hook — tests control loading/cards state
vi.mock("@/hooks/use-cards-data", () => ({
  useCardsData: vi.fn(),
}));

// Minimal framer-motion mock
vi.mock("framer-motion", () => ({
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: {
    div: ({
      children,
      animate: _a,
      exit: _e,
      initial: _i,
      transition: _t,
      layoutId: _l,
      style: _s,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      exit?: unknown;
      initial?: unknown;
      transition?: unknown;
      layoutId?: unknown;
    }) => <div {...props}>{children}</div>,
    button: ({
      children,
      animate: _a,
      transition: _t,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      animate?: unknown;
      transition?: unknown;
    }) => <button {...props}>{children}</button>,
  },
  useReducedMotion: () => false,
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useTransform: () => ({ get: () => 0 }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
}));

import { useCardsData } from "@/hooks/use-cards-data";
const mockUseCardsData = vi.mocked(useCardsData);

const noopUpdateUsage = vi.fn().mockResolvedValue(undefined);

describe("CardsPage", () => {
  it("renders loading skeleton while fetching", () => {
    mockUseCardsData.mockReturnValue({
      cards: [],
      loading: true,
      error: null,
      retry: vi.fn(),
      updateBenefitUsage: noopUpdateUsage,
      syncBenefitTracked: vi.fn(),
      syncBenefitActivation: vi.fn(),
    });

    render(<CardsPage />);

    expect(screen.getByLabelText("Loading cards")).toBeDefined();
  });

  it("renders empty state when 0 cards returned", () => {
    mockUseCardsData.mockReturnValue({
      cards: [],
      loading: false,
      error: null,
      retry: vi.fn(),
      updateBenefitUsage: noopUpdateUsage,
      syncBenefitTracked: vi.fn(),
      syncBenefitActivation: vi.fn(),
    });

    render(<CardsPage />);

    expect(screen.getByText("No cards added yet.")).toBeDefined();
    const adminLink = screen.getByRole("link", { name: /go to admin/i });
    expect((adminLink as HTMLAnchorElement).href).toContain("/admin");
  });
});
