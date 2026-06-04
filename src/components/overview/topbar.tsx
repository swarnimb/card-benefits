"use client";

import { useEffect, useState } from "react";
import { OV } from "./tokens";

/** Client-side time-of-day greeting. Computed after mount to avoid SSR/client skew. */
function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Overview top bar — greeting eyebrow + "Overview" title. The design's search
 * button is intentionally omitted (decided). No user name (not in the data).
 */
export function TopBar() {
  // Default to a stable value for SSR/first paint; resolve real greeting on mount.
  const [greeting, setGreeting] = useState("Good evening");
  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  return (
    <div className="flex items-center justify-between px-[18px] pt-3 pb-3">
      <div>
        <div
          className="mb-0.5 text-[11px]"
          style={{ letterSpacing: "0.4px", color: OV.text3 }}
        >
          {greeting}
        </div>
        <div
          className="text-[20px] font-semibold"
          style={{ letterSpacing: "-0.5px", color: OV.text }}
        >
          Overview
        </div>
      </div>
    </div>
  );
}
