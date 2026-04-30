import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UsageToggle } from "@/components/cards/usage-toggle";
import { UsageCounter } from "@/components/cards/usage-counter";

afterEach(() => cleanup());

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      animate: _animate,
      transition: _transition,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      animate?: unknown;
      transition?: unknown;
    }) => <button {...props}>{children}</button>,
    span: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLSpanElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: () => false,
}));

describe("UsageToggle", () => {
  it("calls onUpdate(1) when not activated and clicked", () => {
    const onUpdate = vi.fn();
    render(
      <UsageToggle
        benefitId="t1"
        isActivated={false}
        cardColor="#C9A84C"
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByTestId("usage-toggle-t1"));
    expect(onUpdate).toHaveBeenCalledWith(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("calls onUpdate(0) when activated and clicked", () => {
    const onUpdate = vi.fn();
    render(
      <UsageToggle
        benefitId="t2"
        isActivated={true}
        cardColor="#C9A84C"
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByTestId("usage-toggle-t2"));
    expect(onUpdate).toHaveBeenCalledWith(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("UsageCounter", () => {
  it("disables minus button when count is 0", () => {
    render(
      <UsageCounter benefitId="c1" count={0} max={5} onUpdate={vi.fn()} />
    );

    const decrementBtn = screen.getByLabelText("Decrease count") as HTMLButtonElement;
    expect(decrementBtn.disabled).toBe(true);
  });

  it("disables plus button when count equals max", () => {
    render(
      <UsageCounter benefitId="c2" count={5} max={5} onUpdate={vi.fn()} />
    );

    const incrementBtn = screen.getByLabelText("Increase count") as HTMLButtonElement;
    expect(incrementBtn.disabled).toBe(true);
  });
});
