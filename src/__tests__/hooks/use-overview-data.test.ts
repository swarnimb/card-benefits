// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { useOverviewData } from "@/hooks/use-overview-data";
import {
  buildActiveCreditsByCategory,
  buildSparkbarSegments,
} from "@/lib/engine/expiring";
import type { OverviewBenefit, OverviewData } from "@/types/api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function credit(
  over: Partial<OverviewBenefit> & { benefitId: string },
): OverviewBenefit {
  return {
    benefitName: "Credit",
    cardName: "Card",
    issuer: "Amex",
    cardColor: "#C9A961",
    type: "credit",
    category: "travel",
    unusedAmount: 0,
    daysUntilReset: 10,
    cardId: "c1",
    value: 100,
    usedAmount: 0,
    resetPeriod: "monthly",
    setAndForget: false,
    ...over,
  };
}

/** Seed: one at-risk credit ($100 unused, resets in 3d) + one on-track dining credit ($50 unused). */
function seedData(): OverviewData {
  const atRisk = credit({
    benefitId: "b1",
    value: 100,
    usedAmount: 0,
    unusedAmount: 100,
    daysUntilReset: 3,
  });
  const onTrack = credit({
    benefitId: "b2",
    category: "dining",
    value: 50,
    usedAmount: 0,
    unusedAmount: 50,
    daysUntilReset: 20,
  });
  return {
    moneyAtRisk: { totalUnredeemed: 100, soonestDaysUntilReset: 3 },
    needsAttention: [atRisk],
    onTrack: [onTrack],
    done: [],
    activeByCategory: buildActiveCreditsByCategory([onTrack]),
    sparkbar: buildSparkbarSegments([atRisk]),
  };
}

/** fetch stub: GET /api/overview → seed; POST /usage → ok/!ok per postOk. */
function mockFetch(postOk: boolean) {
  return vi.fn((_url: string, opts?: { method?: string }) => {
    if (opts?.method === "POST") {
      return Promise.resolve({ ok: postOk, status: postOk ? 200 : 500 });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => seedData() });
  });
}

describe("useOverviewData", () => {
  it("recomputes money-at-risk and category total after a usage update", async () => {
    vi.stubGlobal("fetch", mockFetch(true));
    const { result } = renderHook(() => useOverviewData());
    await waitFor(() => expect(result.current.state.status).toBe("ok"));

    // Fully redeem the at-risk credit → money-at-risk + sparkbar drop to zero.
    await act(async () => {
      await result.current.updateBenefitUsage("b1", 100);
    });
    const afterRisk = result.current.state;
    expect(afterRisk.status).toBe("ok");
    if (afterRisk.status === "ok") {
      expect(afterRisk.data.moneyAtRisk.totalUnredeemed).toBe(0);
      expect(afterRisk.data.sparkbar).toHaveLength(0);
    }

    // Spend $20 of the on-track dining credit → its category total drops 50 → 30.
    await act(async () => {
      await result.current.updateBenefitUsage("b2", 20);
    });
    const afterCategory = result.current.state;
    if (afterCategory.status === "ok") {
      const dining = afterCategory.data.activeByCategory.find(
        (g) => g.group === "Dining",
      );
      expect(dining?.totalRemaining).toBe(30);
      expect(dining?.totalUsed).toBe(20);
    }
  });

  it("reverts to previous state when the POST fails", async () => {
    vi.stubGlobal("fetch", mockFetch(false));
    const { result } = renderHook(() => useOverviewData());
    await waitFor(() => expect(result.current.state.status).toBe("ok"));

    await act(async () => {
      await expect(
        result.current.updateBenefitUsage("b1", 100),
      ).rejects.toThrow(/Failed to update usage/);
    });

    const reverted = result.current.state;
    expect(reverted.status).toBe("ok");
    if (reverted.status === "ok") {
      expect(reverted.data.moneyAtRisk.totalUnredeemed).toBe(100);
      expect(reverted.data.needsAttention[0].usedAmount).toBe(0);
    }
  });
});
