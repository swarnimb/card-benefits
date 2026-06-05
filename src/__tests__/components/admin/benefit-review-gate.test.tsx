import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// The restyled review gate + rows animate with framer-motion. Mock it so
// AnimatePresence/motion render synchronously and expand panels are immediately
// present in the DOM.
vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { BenefitReviewGate } from "@/components/admin/benefit-review-gate";
import { BenefitEditRow } from "@/components/admin/benefit-edit-row";
import type { DraftBenefit } from "@/types/benefit";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

const DRAFT: DraftBenefit = {
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
  setAndForget: false,
  confidence: "high",
};

const EXCLUDED: DraftBenefit = {
  name: "5x Points on Flights",
  description: null,
  type: "perk",
  value: null,
  valueUnit: "points",
  resetPeriod: "once",
  resetAnchor: "calendar",
  category: "travel",
  classification: "auto-earn",
  tracked: false,
  setAndForget: false,
  confidence: "low",
};

describe("BenefitReviewGate", () => {
  it("shows amber banner when scrapeError prop provided", () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[]}
        scrapeError="Page blocked by bot detection"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Page blocked by bot detection")).toBeDefined();
    expect(screen.getByText("Add benefits manually below")).toBeDefined();
  });

  it("disables Save when 0 benefit rows", () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save 0 benefits/i });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
  });

  it("review gate renders confidence badge + annual-fee field", () => {
    const lowDraft: DraftBenefit = {
      ...DRAFT,
      name: "Resy Credit",
      confidence: "low",
      note: "Two $50 statement credits — confirm timing",
    };

    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[lowDraft]}
        initialAnnualFee={325}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Amber "Review" badge + note render for the low-confidence draft.
    expect(screen.getByTestId("review-badge").textContent).toBe("Review");
    expect(
      screen.getByText("Two $50 statement credits — confirm timing")
    ).toBeDefined();

    // The pre-filled, editable annual-fee field renders (CONSTRAINT-21).
    const feeInput = screen.getByLabelText("Annual fee in dollars") as HTMLInputElement;
    expect(feeInput).toBeDefined();
    expect(feeInput.value).toBe("325");
  });

  it("shows parseError banner when provided", () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[DRAFT]}
        parseError="Claude API rate limited"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Claude API rate limited")).toBeDefined();
  });

  it('renders excluded collapsed behind "N auto-excluded" summary', () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[DRAFT, EXCLUDED]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Summary with exact count is shown, excluded row is NOT yet visible.
    expect(
      screen.getByText("1 auto-excluded as non-trackable — expand to review")
    ).toBeDefined();
    expect(screen.queryByText("5x Points on Flights")).toBeNull();
    // Tracked row stays prominent (rendered, not collapsed) — name shown as the
    // row label (the restyled row shows the editable input only when expanded).
    expect(screen.getByText("Travel Credit")).toBeDefined();

    // Expanding the disclosure reveals the excluded row label.
    fireEvent.click(
      screen.getByRole("button", { name: /auto-excluded as non-trackable/i })
    );
    expect(screen.getByText("5x Points on Flights")).toBeDefined();
    // Expanding that row exposes the editable name field.
    fireEvent.click(screen.getByRole("button", { name: /edit 5x points on flights/i }));
    expect(screen.getByDisplayValue("5x Points on Flights")).toBeDefined();
  });

  it("includes expanded excluded rows in confirm payload with classification", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const onSave = vi.fn();

    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[DRAFT, EXCLUDED]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    // Save count reflects the TOTAL, not just tracked rows.
    fireEvent.click(screen.getByRole("button", { name: /save 2 benefits/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.benefits).toHaveLength(2);
    const excluded = body.benefits.find(
      (b: DraftBenefit) => b.name === "5x Points on Flights"
    );
    expect(excluded).toBeDefined();
    expect(excluded.tracked).toBe(false);
    expect(excluded.classification).toBe("auto-earn");
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });

  it("shows no auto-excluded summary when none excluded", () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[DRAFT]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText(/auto-excluded as non-trackable/i)).toBeNull();
  });

  it("still shows amber banner when scrapeError provided alongside excluded rows", () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[EXCLUDED]}
        scrapeError="Page blocked by bot detection"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Page blocked by bot detection")).toBeDefined();
    expect(screen.getByText("Add benefits manually below")).toBeDefined();
    // Degraded path: 0 tracked + some excluded — Save reflects total, enabled.
    const saveButton = screen.getByRole("button", { name: /save 1 benefit/i });
    expect(saveButton.hasAttribute("disabled")).toBe(false);
  });

  it("shows network error and logs when confirm fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSave = vi.fn();

    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[DRAFT]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /save 1 benefit/i }));

    await waitFor(() =>
      expect(screen.getByText("Network error — could not save")).toBeDefined()
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("blocks save and shows name error when a benefit name is empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const blank: DraftBenefit = { ...DRAFT, name: "  " };

    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[blank]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /save 1 benefit/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required")).toBeDefined();
  });

  it("adds a blank row when Add benefit clicked", () => {
    render(
      <BenefitReviewGate
        userCardId="uc-1"
        initialBenefits={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add benefit/i }));

    // A new blank row appears collapsed (label "Untitled benefit"); expanding it
    // exposes the editable name input.
    expect(screen.getByText("Untitled benefit")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /edit benefit/i }));
    expect(screen.getByPlaceholderText("Benefit name")).toBeDefined();
  });
});

describe("BenefitEditRow", () => {
  it("calls onRemove when discard clicked", () => {
    const onRemove = vi.fn();

    render(
      <BenefitEditRow
        benefit={DRAFT}
        onChange={vi.fn()}
        onRemove={onRemove}
      />
    );

    // Discard lives in the expand-to-edit panel — open the row first.
    fireEvent.click(screen.getByRole("button", { name: /edit travel credit/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove benefit/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("calls onChange with updated name", () => {
    const onChange = vi.fn();

    render(
      <BenefitEditRow
        benefit={DRAFT}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit travel credit/i }));
    fireEvent.change(screen.getByLabelText("Benefit name"), {
      target: { value: "Dining Credit" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dining Credit" })
    );
  });

  it("renders the amber Review badge + note for a low-confidence draft", () => {
    const lowDraft: DraftBenefit = {
      ...DRAFT,
      name: "Resy Credit",
      confidence: "low",
      note: "Two $50 statement credits — confirm timing",
    };

    render(<BenefitEditRow benefit={lowDraft} onChange={vi.fn()} onRemove={vi.fn()} />);

    // Amber "Review" badge (review-only) + the collapsed note are visible.
    expect(screen.getByTestId("review-badge").textContent).toBe("Review");
    expect(
      screen.getByText("Two $50 statement credits — confirm timing")
    ).toBeDefined();
  });
});
