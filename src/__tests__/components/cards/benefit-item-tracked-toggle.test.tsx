import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { BenefitItem } from "@/components/cards/benefit-item";
import type { BenefitWithPeriod } from "@/types/benefit";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

function makeBenefit(overrides: Partial<BenefitWithPeriod> = {}): BenefitWithPeriod {
  return {
    id: "b-1",
    userCardId: "card-1",
    name: "Travel Credit",
    description: null,
    type: "credit",
    value: 300,
    valueUnit: "dollars",
    resetPeriod: "annual",
    resetAnchor: "calendar",
    category: "travel",
    classification: "discretionary-credit",
    tracked: true,
    createdAt: new Date(),
    currentPeriod: null,
    ...overrides,
  };
}

describe("BenefitItem tracked toggle", () => {
  it("flips optimistically and fires PATCH with the new tracked value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const onTrackedUpdate = vi.fn();

    render(
      <BenefitItem
        benefit={makeBenefit({ id: "b-1", tracked: true })}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
        onTrackedUpdate={onTrackedUpdate}
      />
    );

    const toggle = screen.getByTestId("tracked-toggle-b-1");
    // Starts tracked.
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle);

    // Optimistic flip is synchronous (no awaiting the PATCH).
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/benefits/b-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ tracked: false });

    // Parent sync callback fired with the new value after success.
    await waitFor(() => expect(onTrackedUpdate).toHaveBeenCalledWith("b-1", false));

    // State stays flipped on success.
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("reverts the optimistic flip and shows an error when PATCH returns 500", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onTrackedUpdate = vi.fn();

    render(
      <BenefitItem
        benefit={makeBenefit({ id: "b-2", tracked: true })}
        cardColor="#117ACA"
        onUsageUpdate={vi.fn()}
        onTrackedUpdate={onTrackedUpdate}
      />
    );

    const toggle = screen.getByTestId("tracked-toggle-b-2");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle);

    // Optimistic flip applied immediately.
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    // Revert lands once the rejected response is processed.
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));
    await waitFor(() =>
      expect(screen.getByText(/could not update/i)).toBeDefined()
    );

    // Parent sync NOT called on failure.
    expect(onTrackedUpdate).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
