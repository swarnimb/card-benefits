import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { ManagedBenefitRow } from "@/components/admin/managed-benefit-row";
import type { BenefitWithPeriod } from "@/types/benefit";

afterEach(() => cleanup());

const BENEFIT: BenefitWithPeriod = {
  id: "b-1",
  userCardId: "uc-1",
  name: "Dining Credit",
  description: null,
  type: "credit",
  value: 100,
  valueUnit: "dollars",
  resetPeriod: "monthly",
  resetAnchor: "calendar",
  category: "dining",
  classification: "discretionary-credit",
  source: "scraped",
  tracked: true,
  setAndForget: false,
  activatedAt: null,
  createdAt: new Date("2026-01-01"),
  currentPeriod: null,
};

describe("ManagedBenefitRow", () => {
  it("renders the name and per-window amount, and exposes Edit/Delete", () => {
    render(<ManagedBenefitRow benefit={BENEFIT} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Dining Credit")).toBeDefined();
    expect(screen.getByText("$100")).toBeDefined();
    expect(screen.getByText("per month")).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
  });

  it("PATCHes the edited value and reflects the new value on save", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    render(<ManagedBenefitRow benefit={BENEFIT} onEdit={onEdit} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const [id, patch] = onEdit.mock.calls[0];
    expect(id).toBe("b-1");
    expect(patch.value).toBe(250);
    expect(patch.name).toBe("Dining Credit");
  });

  it("requires confirm before DELETE; cancel issues no delete", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ManagedBenefitRow benefit={BENEFIT} onEdit={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    // Confirm prompt appears; no DELETE yet.
    expect(screen.getByText(/Delete Dining Credit\?/)).toBeDefined();
    expect(onDelete).not.toHaveBeenCalled();

    // Cancel keeps the benefit and issues no request.
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(onDelete).not.toHaveBeenCalled();

    // Now confirm → DELETE fires.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete benefit" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("b-1"));
  });

  it("keeps the benefit and shows an error when delete fails", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("boom"));
    render(<ManagedBenefitRow benefit={BENEFIT} onEdit={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete benefit" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/Could not delete benefit/)).toBeDefined();
    // Benefit still rendered.
    expect(screen.getByText("Dining Credit")).toBeDefined();
  });
});
