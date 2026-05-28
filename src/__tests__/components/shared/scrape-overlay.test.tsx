import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScrapeOverlay } from "@/components/shared/scrape-overlay";

afterEach(() => cleanup());

describe("ScrapeOverlay", () => {
  it("renders the card name in the loading copy when visible", () => {
    render(<ScrapeOverlay visible cardName="Amex Gold" />);
    expect(screen.getByText(/Scraping Amex Gold/)).toBeTruthy();
    expect(screen.getByText(/This usually takes/)).toBeTruthy();
    // role=status drives the aria-live announcement for screen readers.
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("falls back to generic copy when visible without a card name", () => {
    render(<ScrapeOverlay visible cardName={null} />);
    expect(screen.getByText(/Scraping benefits/)).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    render(<ScrapeOverlay visible={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
