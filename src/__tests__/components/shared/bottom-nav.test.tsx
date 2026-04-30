import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(() => cleanup());
import { BottomNav } from "@/components/shared/bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { usePathname } from "next/navigation";

describe("BottomNav", () => {
  it("renders 3 tabs with correct labels", () => {
    vi.mocked(usePathname).mockReturnValue("/overview");
    render(<BottomNav />);
    expect(screen.getByText("Overview")).toBeDefined();
    expect(screen.getByText("Cards")).toBeDefined();
    expect(screen.getByText("Admin")).toBeDefined();
  });

  it("applies active styles to current route tab", () => {
    vi.mocked(usePathname).mockReturnValue("/cards");
    render(<BottomNav />);
    const cardsLink = screen.getByText("Cards").closest("a");
    const overviewLink = screen.getByText("Overview").closest("a");
    expect(cardsLink?.className).toContain("text-foreground");
    expect(overviewLink?.className).toContain("text-muted-foreground");
  });
});
