import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { CardManagementList, type ManagedCard } from "@/components/admin/card-management-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

const CARDS: ManagedCard[] = [
  { id: "uc-1", card: { issuer: "Chase", name: "Sapphire Reserve" }, lastVerifiedAt: null, benefitCount: 5 },
  { id: "uc-2", card: { issuer: "Amex", name: "Gold Card" }, lastVerifiedAt: "2026-04-01T00:00:00Z", benefitCount: 3 },
  { id: "uc-3", card: { issuer: "Citi", name: "Double Cash" }, lastVerifiedAt: null, benefitCount: 0 },
];

describe("CardManagementList", () => {
  it("renders correct number of card rows", () => {
    render(
      <CardManagementList cards={CARDS} onRescrape={vi.fn()} onRemove={vi.fn()} />
    );

    const rows = screen.getAllByTestId("card-row");
    expect(rows).toHaveLength(3);
  });

  it("shows last verified as Never when null", () => {
    render(
      <CardManagementList cards={[CARDS[0]]} onRescrape={vi.fn()} onRemove={vi.fn()} />
    );

    expect(screen.getByText(/Never/)).toBeDefined();
  });

  /**
   * NEW-3 regression: the remove-confirmation title must include the issuer.
   * Before the fix, the title was `Remove ${card.name}?` which rendered as
   * "Remove Sapphire Reserve?" — stripping the issuer that the admin list
   * row itself displays adjacent to the name. We assert the full string is
   * present (issuer + name) and the bare-name form is NOT present.
   */
  it("shows full card name (issuer + name) in remove confirmation title", () => {
    render(
      <CardManagementList cards={CARDS} onRescrape={vi.fn()} onRemove={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Sapphire Reserve" }));

    expect(screen.getByText("Remove Chase Sapphire Reserve?")).toBeDefined();
    expect(screen.queryByText("Remove Sapphire Reserve?")).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Remove card?"
        description="This will delete everything."
        confirmLabel="Remove"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        destructive
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Remove card?"
        description="This will delete everything."
        confirmLabel="Remove"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("AdminPage", () => {
  it("renders empty state when 0 cards", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
    ));

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByText(/No cards yet/)).toBeDefined()
    );
  });
});
