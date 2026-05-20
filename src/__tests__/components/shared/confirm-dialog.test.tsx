import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

/**
 * ConfirmDialog drives destructive styling through the shadcn Button `variant`
 * prop forwarded by AlertDialogAction. We assert the rendered class string
 * directly because variant-vs-className conflicts were the original NEW-2 bug
 * (inline `bg-destructive` lost the specificity war against the default
 * `bg-primary` variant). The variant route bypasses that conflict by skipping
 * the default class entirely.
 */
describe("ConfirmDialog", () => {
  const baseProps = {
    open: true,
    title: "Remove card?",
    description: "All benefits and usage history will be deleted.",
    confirmLabel: "Remove",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders with destructive (red) styling when destructive prop is true", () => {
    render(<ConfirmDialog {...baseProps} destructive />);
    const confirmButton = screen.getByRole("button", { name: "Remove" });
    // jest-dom matchers aren't loaded in this project; assert via raw className.
    expect(confirmButton.className).toContain("bg-destructive");
    expect(confirmButton.className).not.toContain("bg-primary");
  });

  it("renders with default styling when destructive prop is false or absent", () => {
    render(<ConfirmDialog {...baseProps} />);
    const confirmButton = screen.getByRole("button", { name: "Remove" });
    expect(confirmButton.className).toContain("bg-primary");
    expect(confirmButton.className).not.toContain("bg-destructive");
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} destructive />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
