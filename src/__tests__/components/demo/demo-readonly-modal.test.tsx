import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { DemoReadonlyModal } from "@/components/demo/demo-readonly-modal";
import { DemoBanner } from "@/components/demo/demo-banner";
import { emitDemoBlocked } from "@/lib/demo/demo-api";

afterEach(() => cleanup());

describe("DemoReadonlyModal", () => {
  it("renders the read-only message and a GitHub link to the repo", () => {
    render(<DemoReadonlyModal onClose={vi.fn()} />);

    expect(screen.getByText("Read-only demo")).toBeDefined();
    const link = screen.getByRole("link", { name: /view on github/i }) as HTMLAnchorElement;
    expect(link.href).toContain("github.com/swarnimb/card-benefits");
    expect(link.target).toBe("_blank");
  });

  it("calls onClose when the Got it button is clicked", () => {
    const onClose = vi.fn();
    render(<DemoReadonlyModal onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<DemoReadonlyModal onClose={onClose} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked but not the modal card", () => {
    const onClose = vi.fn();
    render(<DemoReadonlyModal onClose={onClose} />);

    // Clicking inside the card must not close (stopPropagation).
    fireEvent.click(screen.getByText("Read-only demo"));
    expect(onClose).not.toHaveBeenCalled();

    // Clicking the backdrop (the dialog root) closes.
    fireEvent.click(screen.getByTestId("demo-readonly-modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DemoBanner", () => {
  it("shows the read-only message and a GitHub link without an em-dash", () => {
    render(<DemoBanner />);

    const banner = screen.getByTestId("demo-banner");
    expect(banner.textContent).toContain("Demo: fictional data, read-only");
    expect(banner.textContent).not.toContain("—"); // no em-dash
    const link = screen.getByRole("link", { name: /view on github/i }) as HTMLAnchorElement;
    expect(link.href).toContain("github.com/swarnimb/card-benefits");
  });

  it("opens the read-only modal when a blocked write is emitted", () => {
    render(<DemoBanner />);
    expect(screen.queryByTestId("demo-readonly-modal")).toBeNull();

    act(() => {
      emitDemoBlocked();
    });

    expect(screen.getByTestId("demo-readonly-modal")).toBeDefined();
  });
});
