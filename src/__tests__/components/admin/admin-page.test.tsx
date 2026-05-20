import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { CardManagementList, type ManagedCard } from "@/components/admin/card-management-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/**
 * Mock AddCardModal so we can drive `handleAddSuccess` directly from the test
 * without simulating the full add-card form. When `open`, renders a single
 * button that calls onSuccess(FRESH_USER_CARD_ID) — enough to set the parent's
 * `freshAddCardId` state and trigger the scrape flow.
 */
const FRESH_USER_CARD_ID = "uc-fresh-1";
vi.mock("@/components/admin/add-card-modal", () => ({
  AddCardModal: ({ open, onSuccess }: { open: boolean; onSuccess: (id: string) => void }) =>
    open ? (
      <button data-testid="fake-add-success" onClick={() => onSuccess(FRESH_USER_CARD_ID)}>
        fake add
      </button>
    ) : null,
}));

const MOCK_DRAFT_BENEFIT = {
  name: "Test Credit",
  description: null,
  type: "credit",
  value: 100,
  valueUnit: "dollars",
  resetPeriod: "monthly",
  resetAnchor: "calendar",
  category: "general",
  classification: "discretionary-credit",
  tracked: true,
  confidence: 1,
};

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

  /**
   * NEW-1 regression: when a user adds a brand-new card and Cancels the
   * review gate (e.g. after a scrape failure), the orphan userCard must be
   * DELETEd to roll back. Without this, the card-list grows broken rows that
   * the user has to remove manually.
   */
  it("fresh-add Cancel triggers DELETE on userCard (NEW-1)", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/user-cards" && !init?.method) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url === `/api/user-cards/${FRESH_USER_CARD_ID}/scrape`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ benefits: [MOCK_DRAFT_BENEFIT] }),
        });
      }
      if (url === `/api/user-cards/${FRESH_USER_CARD_ID}` && init?.method === "DELETE") {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(`{"ok":true}`) });
      }
      return Promise.reject(new Error(`unmocked fetch: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/No cards yet/)).toBeDefined());

    // Open mocked add modal, then trigger handleAddSuccess via the fake button.
    fireEvent.click(screen.getAllByRole("button", { name: /Add Card/ })[0]);
    fireEvent.click(await screen.findByTestId("fake-add-success"));

    // Review gate renders once scrape completes.
    // Anchor on the Save button (unique to the gate) — page H1 and gate <p>
    // both contain "Review Benefits", which makes that text query ambiguous.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull(),
    );

    // Click Cancel — should fire DELETE on the orphan card.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === `/api/user-cards/${FRESH_USER_CARD_ID}` &&
          (init as RequestInit | undefined)?.method === "DELETE",
      );
      expect(deleteCalls).toHaveLength(1);
    });

    // Gate should hide on successful rollback.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).toBeNull(),
    );
  });

  /**
   * NEW-1 regression — re-scrape branch: Cancel on a re-scrape of an
   * existing card must NOT delete the card. Only the gate hides.
   */
  it("re-scrape Cancel does NOT trigger DELETE (NEW-1)", async () => {
    const existing: ManagedCard = {
      id: "uc-existing",
      card: { issuer: "Chase", name: "Freedom" },
      lastVerifiedAt: "2026-04-01T00:00:00Z",
      benefitCount: 3,
    };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/user-cards" && !init?.method) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([existing]) });
      }
      if (url === "/api/user-cards/uc-existing/scrape") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ benefits: [MOCK_DRAFT_BENEFIT] }),
        });
      }
      // Any DELETE must fail loudly so the test breaks if the branch fires wrongly.
      return Promise.reject(new Error(`unmocked fetch: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/Freedom/)).toBeDefined());

    // Click Refresh on the existing card (re-scrape).
    fireEvent.click(screen.getByRole("button", { name: "Refresh benefits for Freedom" }));

    // Anchor on the Save button (unique to the gate) — page H1 and gate <p>
    // both contain "Review Benefits", which makes that text query ambiguous.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull(),
    );

    // Click Cancel — must NOT call DELETE.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).toBeNull(),
    );

    const deleteCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCalls).toHaveLength(0);
  });

  /**
   * NEW-1 / EH-01 — DELETE failure on fresh-add Cancel must surface a loud,
   * contextual error to the user (HTTP status + userCardId in message). The
   * gate stays open so the user can retry or proceed manually.
   */
  it("DELETE failure on fresh-add Cancel surfaces error (no silent swallow)", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/user-cards" && !init?.method) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url === `/api/user-cards/${FRESH_USER_CARD_ID}/scrape`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ benefits: [MOCK_DRAFT_BENEFIT] }),
        });
      }
      if (url === `/api/user-cards/${FRESH_USER_CARD_ID}` && init?.method === "DELETE") {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("db connection lost"),
        });
      }
      return Promise.reject(new Error(`unmocked fetch: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    // Silence the expected console.error so test output stays clean.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/No cards yet/)).toBeDefined());

    fireEvent.click(screen.getAllByRole("button", { name: /Add Card/ })[0]);
    fireEvent.click(await screen.findByTestId("fake-add-success"));

    // Anchor on the Save button (unique to the gate) — page H1 and gate <p>
    // both contain "Review Benefits", which makes that text query ambiguous.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Error block must appear with userCardId and HTTP status (EH-02).
    const errorElement = await screen.findByTestId("cancel-error");
    expect(errorElement.textContent).toContain(FRESH_USER_CARD_ID);
    expect(errorElement.textContent).toContain("500");

    // Gate must remain open so user can retry or proceed — Save button still visible.
    expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
