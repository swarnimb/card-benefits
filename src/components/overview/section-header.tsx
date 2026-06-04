"use client";

import type { ReactNode } from "react";
import { OV } from "./tokens";

interface SectionHeaderProps {
  label: string;
  right?: ReactNode;
}

/** Uppercase section header with an optional right-aligned accessory — ported from the design source. */
export function SectionHeader({ label, right }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-1 pb-3">
      <div
        className="text-[11px] font-medium uppercase"
        style={{ letterSpacing: "1.1px", color: OV.text3 }}
      >
        {label}
      </div>
      {right != null && (
        <div
          className="text-[11px] font-medium"
          style={{ letterSpacing: "0.3px", color: OV.text3 }}
        >
          {right}
        </div>
      )}
    </div>
  );
}
