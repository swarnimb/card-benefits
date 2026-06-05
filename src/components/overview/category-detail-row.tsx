import type { OverviewBenefit } from "@/types/api";
import { OV, OV_URGENT_DAYS } from "./tokens";
import { usd, humanizeIssuer } from "./format";
import { IssuerDot } from "./issuer-dot";

/**
 * Single credit row inside an expanded category card. Ports the design source
 * `CategoryDetailRow`. Extracted from `category-section.tsx` to keep both files
 * under the 200-line component budget.
 */
export function CategoryDetailRow({ c, last }: { c: OverviewBenefit; last: boolean }) {
  const remaining = c.unusedAmount;
  const fullyUsed = remaining === 0 && c.value !== null;
  const urgent = c.daysUntilReset !== null && c.daysUntilReset <= OV_URGENT_DAYS;

  return (
    <div
      className="flex items-center gap-2.5"
      style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${OV.hairline}` }}
    >
      <IssuerDot color={c.cardColor} size={6} />
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[13px]"
          style={{ color: OV.text, letterSpacing: "-0.1px" }}
        >
          {c.benefitName}
        </div>
        <div className="mt-0.5 text-[10.5px]" style={{ color: OV.text3 }}>
          {humanizeIssuer(c.issuer)} · {c.resetPeriod}
          {urgent && (
            <span style={{ color: OV.amber, marginLeft: 6 }}>· {c.daysUntilReset}d</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className="text-[13.5px] font-medium tabular-nums"
          style={{ color: fullyUsed ? OV.green : OV.text }}
        >
          {fullyUsed ? "Done" : c.value === null ? "—" : usd(remaining)}
        </div>
        <div className="mt-0.5 text-[10px] tabular-nums" style={{ color: OV.text4 }}>
          {usd(c.usedAmount)} / {c.value === null ? "∞" : usd(c.value)}
        </div>
      </div>
    </div>
  );
}
