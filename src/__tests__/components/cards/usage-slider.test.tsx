import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UsageSlider } from "@/components/cards/usage-slider";

afterEach(() => cleanup());

type SliderCallbacks = {
  onValueChange?: (vals: number[]) => void;
  onValueCommit?: (vals: number[]) => void;
};
const sliderRef: SliderCallbacks = {};

vi.mock("radix-ui", () => ({
  Slider: {
    Root: ({ children, onValueChange, onValueCommit, ...props }: React.HTMLAttributes<HTMLDivElement> & SliderCallbacks) => {
      sliderRef.onValueChange = onValueChange;
      sliderRef.onValueCommit = onValueCommit;
      return <div {...props}>{children}</div>;
    },
    Track: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    Range: ({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div style={style} {...props} />
    ),
    Thumb: ({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div style={style} {...props} />
    ),
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

describe("UsageSlider", () => {
  beforeEach(() => {
    sliderRef.onValueChange = undefined;
    sliderRef.onValueCommit = undefined;
  });

  it("clamps manual input to max when value exceeds cap", () => {
    const onUpdate = vi.fn();
    render(
      <UsageSlider
        benefitId="b1"
        value={50}
        max={100}
        cardColor="#117ACA"
        onUpdate={onUpdate}
      />
    );

    const input = screen.getByLabelText("Manual usage input");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);

    expect(onUpdate).toHaveBeenCalledWith(100);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("calls onUpdate only on pointer release, not during drag", () => {
    const onUpdate = vi.fn();
    render(
      <UsageSlider
        benefitId="b2"
        value={30}
        max={100}
        cardColor="#117ACA"
        onUpdate={onUpdate}
      />
    );

    // Simulate drag — onValueChange should NOT call onUpdate
    sliderRef.onValueChange?.([60]);
    expect(onUpdate).not.toHaveBeenCalled();

    // Simulate pointer release — onValueCommit should call onUpdate once
    sliderRef.onValueCommit?.([60]);
    expect(onUpdate).toHaveBeenCalledWith(60);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
