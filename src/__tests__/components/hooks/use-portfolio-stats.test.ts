import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PortfolioStats } from "@/types/api";

/**
 * Task 66 (folded code-review unit gap): the read-only portfolio-stats fetch
 * hook. The happy path is exercised indirectly via the Cards page test; here we
 * cover the untested branches — the loading→ok transition and the error path
 * (non-ok response and rejected fetch both land in `error`).
 */
const STATS: PortfolioStats = { annualFeeTotal: 1245, redeemedYtd: 430, available: 815 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  // The error path logs via console.error — silence the expected noise.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("usePortfolioStats", () => {
  it("starts in loading then transitions to ok with the fetched stats", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => usePortfolioStats());

    // Initial synchronous state is loading (fetch has not resolved yet).
    expect(result.current.status).toBe("loading");

    resolveFetch({ ok: true, status: 200, json: async () => STATS });

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current).toEqual({ status: "ok", stats: STATS });
  });

  it("lands in error when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    );

    const { result } = renderHook(() => usePortfolioStats());

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("lands in error when the fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { result } = renderHook(() => usePortfolioStats());

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
