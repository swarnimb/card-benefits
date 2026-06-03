import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ActivationToggle } from "@/components/cards/activation-toggle";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

describe("ActivationToggle", () => {
  it("renders 'Set up' when not activated and '✓ Active' when activated", () => {
    const { rerender } = render(
      <ActivationToggle benefitId="b-1" activatedAt={null} cardColor="#C9A84C" />
    );
    const toggle = screen.getByTestId("activation-toggle-b-1");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Set up")).toBeDefined();

    rerender(
      <ActivationToggle benefitId="b-1" activatedAt={new Date()} cardColor="#C9A84C" />
    );
    // Re-mount with a fresh id so initial state reads the new activatedAt.
    cleanup();
    render(
      <ActivationToggle benefitId="b-2" activatedAt={new Date()} cardColor="#C9A84C" />
    );
    const active = screen.getByTestId("activation-toggle-b-2");
    expect(active.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Active")).toBeDefined();
  });

  it("flips optimistically and PATCHes the activation endpoint with the new state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ activatedAt: new Date().toISOString() }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onActivated = vi.fn();

    render(
      <ActivationToggle benefitId="b-1" activatedAt={null} cardColor="#C9A84C" onActivated={onActivated} />
    );

    const toggle = screen.getByTestId("activation-toggle-b-1");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    // Optimistic flip is synchronous.
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/benefits/b-1/activation");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ activated: true });

    await waitFor(() => expect(onActivated).toHaveBeenCalledOnce());
    expect(onActivated.mock.calls[0][0]).toBe("b-1");
    expect(onActivated.mock.calls[0][1]).toBeInstanceOf(Date);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("reverts the optimistic flip and shows an error when the PATCH fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onActivated = vi.fn();

    render(
      <ActivationToggle benefitId="b-3" activatedAt={null} cardColor="#C9A84C" onActivated={onActivated} />
    );

    const toggle = screen.getByTestId("activation-toggle-b-3");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true"); // optimistic

    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("false")); // reverted
    await waitFor(() => expect(screen.getByText(/could not update/i)).toBeDefined());
    expect(onActivated).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
