import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { AddBenefitForm } from "@/components/admin/add-benefit-form";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

const CREATED = {
  id: "b-new",
  userCardId: "uc-1",
  name: "Dining Credit",
  value: 300,
  resetPeriod: "semiannual",
  type: "credit",
  category: "dining",
  source: "manual",
  tracked: true,
};

describe("AddBenefitForm", () => {
  it("POSTs the per-window value and reports the created benefit (no classification/source/tracked in body)", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve(CREATED) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onCreated = vi.fn();

    render(<AddBenefitForm userCardId="uc-1" onCreated={onCreated} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Benefit name"), { target: { value: "Dining Credit" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "300" } });
    // Pick a non-default reset window to prove the per-window value flows through.
    fireEvent.click(screen.getByRole("button", { name: "semiannual" }));
    fireEvent.click(screen.getByRole("button", { name: "Save benefit" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED));

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      userCardId: "uc-1",
      name: "Dining Credit",
      value: 300,
      resetPeriod: "semiannual",
      type: "credit",
      category: "general",
    });
    // SEC: server-controlled fields must NOT be present in the body.
    expect(body).not.toHaveProperty("classification");
    expect(body).not.toHaveProperty("source");
    expect(body).not.toHaveProperty("tracked");
  });

  it("disables Save for an empty name", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<AddBenefitForm userCardId="uc-1" onCreated={vi.fn()} onCancel={vi.fn()} />);

    const save = screen.getByRole("button", { name: "Save benefit" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Benefit name"), { target: { value: "Hotel Credit" } });
    expect(save.disabled).toBe(false);
  });

  it("shows an inline error and keeps the form open when the POST fails", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onCreated = vi.fn();

    render(<AddBenefitForm userCardId="uc-1" onCreated={onCreated} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Benefit name"), { target: { value: "Dining Credit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save benefit" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/Could not add benefit/)).toBeDefined();
    expect(onCreated).not.toHaveBeenCalled();
    // Form still open — fields remain.
    expect(screen.getByLabelText("Benefit name")).toBeDefined();
  });
});
