"use client";

import { useState } from "react";
import { Slider } from "radix-ui";
import { motion, useReducedMotion } from "framer-motion";

/** Props for the continuous usage slider (credit-type benefits). */
export interface UsageSliderProps {
  benefitId: string;
  value: number;
  max: number | null;
  cardColor: string;
  onUpdate: (value: number) => void;
}

const UNCAPPED_FALLBACK = 10;

export function UsageSlider({
  benefitId,
  value,
  max,
  cardColor,
  onUpdate,
}: UsageSliderProps) {
  const reducedMotion = useReducedMotion();
  const sliderMax = max !== null ? max : Math.max(value * 2, UNCAPPED_FALLBACK);
  const [liveValue, setLiveValue] = useState(value);
  const [inputText, setInputText] = useState(String(value));
  const [pulseKey, setPulseKey] = useState(0);
  const isComplete = max !== null && liveValue >= max;

  function clamp(raw: number): number {
    const lo = Math.max(0, raw);
    return max !== null ? Math.min(max, lo) : lo;
  }

  function handleSliderChange(vals: number[]): void {
    const next = vals[0];
    setLiveValue(next);
    setInputText(String(next));
  }

  function handleSliderCommit(vals: number[]): void {
    const next = vals[0];
    setLiveValue(next);
    setInputText(String(next));
    if (max !== null && next >= max) setPulseKey((k) => k + 1);
    onUpdate(next);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setInputText(e.target.value);
  }

  function commitInput(): void {
    const parsed = parseFloat(inputText);
    const clamped = isNaN(parsed) ? 0 : clamp(parsed);
    setLiveValue(clamped);
    setInputText(String(clamped));
    if (max !== null && clamped >= max) setPulseKey((k) => k + 1);
    onUpdate(clamped);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") commitInput();
  }

  const label = max !== null ? `$${liveValue} / $${max}` : `$${liveValue}`;

  return (
    <div className="space-y-2" data-testid={`usage-slider-${benefitId}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[#9CA3AF]">{label}</span>
        <input
          type="number"
          value={inputText}
          min={0}
          max={max ?? undefined}
          onChange={handleInputChange}
          onBlur={commitInput}
          onKeyDown={handleInputKeyDown}
          className="w-20 rounded bg-[#252321] px-2 py-1 text-sm text-right text-[#F9F9F8] border border-white/10"
          aria-label="Manual usage input"
        />
      </div>
      <motion.div
        key={pulseKey}
        initial={{ opacity: 1 }}
        animate={
          isComplete && !reducedMotion && pulseKey > 0
            ? { opacity: [1, 0.6, 1] }
            : { opacity: 1 }
        }
        transition={{ duration: 0.4 }}
      >
        <Slider.Root
          value={[liveValue]}
          min={0}
          max={sliderMax}
          step={1}
          onValueChange={handleSliderChange}
          onValueCommit={handleSliderCommit}
          className="relative flex w-full touch-none items-center"
          aria-label={`Usage for benefit ${benefitId}`}
        >
          <Slider.Track className="relative h-2 grow overflow-hidden rounded-full bg-[#374151]">
            <Slider.Range
              className="absolute h-full rounded-full"
              style={{ background: cardColor }}
            />
          </Slider.Track>
          <Slider.Thumb
            className="block h-5 w-5 rounded-full border-2 bg-white shadow focus:outline-none"
            style={{ borderColor: cardColor }}
          />
        </Slider.Root>
      </motion.div>
    </div>
  );
}
