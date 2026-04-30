import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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
  isTrackable: true,
  confidence: 0.95,
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

    expect(screen.getByPlaceholderText("Benefit name")).toBeDefined();
  });
});

describe("BenefitEditRow", () => {
  it("calls onRemove when × clicked", () => {
    const onRemove = vi.fn();

    render(
      <BenefitEditRow
        benefit={DRAFT}
        onChange={vi.fn()}
        onRemove={onRemove}
      />
    );

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

    fireEvent.change(screen.getByLabelText("Benefit name"), {
      target: { value: "Dining Credit" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dining Credit" })
    );
  });
});
