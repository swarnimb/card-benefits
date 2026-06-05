import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

// All admin flow components animate with framer-motion. Mock it so views,
// expand panels, and the toast render synchronously in jsdom.
vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { ManagedRow, type ManagedCard as RowCard } from "@/components/admin/managed-row";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/**
 * Mock AddPicker so we can drive `onAdded` (the post-POST callback) directly
 * without simulating the full picker. When mounted it renders a single button
 * that calls onAdded(FRESH_USER_CARD_ID) — enough to set the parent's
 * freshAddCardId and start the scan → review flow.
 */
const FRESH_USER_CARD_ID = "uc-fresh-1";
vi.mock("@/components/admin/add-picker", () => ({
  AddPicker: ({ onAdded }: { onAdded: (id: string) => void }) => (
    <button data-testid="fake-add-success" onClick={() => onAdded(FRESH_USER_CARD_ID)}>
      fake add
    </button>
  ),
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
  setAndForget: false,
  confidence: "high",
};

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

const ROW_CARDS: RowCard[] = [
  { id: "uc-1", card: { issuer: "Chase", name: "Sapphire Reserve", defaultColor: "#3B5BDB" }, lastVerifiedAt: null, benefitCount: 5 },
  { id: "uc-2", card: { issuer: "Amex", name: "Gold Card", defaultColor: "#C9A961" }, lastVerifiedAt: "2026-04-01T00:00:00Z", benefitCount: 3 },
];

describe("ManagedRow", () => {
  it("renders product, issuer, and benefit count", () => {
    render(<ManagedRow card={ROW_CARDS[0]} onRescrape={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("Sapphire Reserve")).toBeDefined();
    expect(screen.getByText("Chase")).toBeDefined();
    expect(screen.getByText("5 benefits")).toBeDefined();
  });

  it("shows last checked as Never when lastVerifiedAt is null", () => {
    render(<ManagedRow card={ROW_CARDS[0]} onRescrape={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Never")).toBeDefined();
  });

  /**
   * NEW-3 regression: the inline remove-confirmation must include the issuer +
   * name (e.g. "Remove Chase Sapphire Reserve …"), not the bare card name.
   */
  it("shows issuer + name in the inline remove confirmation", () => {
    render(<ManagedRow card={ROW_CARDS[0]} onRescrape={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Sapphire Reserve" }));

    expect(
      screen.getByText(/Remove Chase Sapphire Reserve and its 5 benefits\?/)
    ).toBeDefined();
  });

  it("calls onRemove with the card id when confirmed", () => {
    const onRemove = vi.fn();
    render(<ManagedRow card={ROW_CARDS[0]} onRescrape={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Sapphire Reserve" }));
    // The destructive "Remove" button inside the inline confirm.
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("uc-1");
  });

  it("calls onRescrape with the card id", () => {
    const onRescrape = vi.fn();
    render(<ManagedRow card={ROW_CARDS[0]} onRescrape={onRescrape} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh benefits for Sapphire Reserve" }));
    expect(onRescrape).toHaveBeenCalledWith("uc-1");
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
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
    ));

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/No cards yet/)).toBeDefined());
  });

  /**
   * NEW-1 regression: fresh-add Cancel must DELETE the orphan userCard.
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

    // Open the (mocked) picker, fire onAdded → scan → review.
    fireEvent.click(screen.getByRole("button", { name: /Add a card/ }));
    fireEvent.click(await screen.findByTestId("fake-add-success"));

    // Review gate renders once the scan settles — anchor on the Save button.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === `/api/user-cards/${FRESH_USER_CARD_ID}` &&
          (init as RequestInit | undefined)?.method === "DELETE",
      );
      expect(deleteCalls).toHaveLength(1);
    });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).toBeNull(),
    );
  });

  /**
   * NEW-1 regression — re-scrape branch: Cancel on a re-scrape must NOT delete.
   */
  it("re-scrape Cancel does NOT trigger DELETE (NEW-1)", async () => {
    const existing = {
      id: "uc-existing",
      card: { issuer: "Chase", name: "Freedom", defaultColor: "#3B5BDB" },
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
      return Promise.reject(new Error(`unmocked fetch: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/Freedom/)).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Refresh benefits for Freedom" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull(),
    );

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
   * NEW-1 / EH-01 — DELETE failure on fresh-add Cancel surfaces a loud,
   * contextual error (HTTP status + userCardId). Gate stays open.
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
        return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("db connection lost") });
      }
      return Promise.reject(new Error(`unmocked fetch: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/No cards yet/)).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: /Add a card/ }));
    fireEvent.click(await screen.findByTestId("fake-add-success"));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const errorElement = await screen.findByTestId("cancel-error");
    expect(errorElement.textContent).toContain(FRESH_USER_CARD_ID);
    expect(errorElement.textContent).toContain("500");

    expect(screen.queryByRole("button", { name: /^Save \d+ benefit/ })).not.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  /**
   * CONSTRAINT-20 guard: the toast fires on card ADD and card REMOVE — and is
   * NOT triggered by a benefit edit / tracked change in the review flow.
   */
  it("toast fires on add/remove, not on tracking update (CONSTRAINT-20)", async () => {
    const existing = {
      id: "uc-existing",
      card: { issuer: "Chase", name: "Freedom", defaultColor: "#3B5BDB" },
      lastVerifiedAt: "2026-04-01T00:00:00Z",
      benefitCount: 3,
    };
    let cardsState: unknown[] = [existing];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/user-cards" && !init?.method) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cardsState) });
      }
      if (url === `/api/user-cards/${FRESH_USER_CARD_ID}/scrape`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ benefits: [MOCK_DRAFT_BENEFIT] }),
        });
      }
      if (url === "/api/benefits/confirm" && init?.method === "POST") {
        // Simulate the new card now present in the list after confirm.
        cardsState = [
          ...cardsState,
          {
            id: FRESH_USER_CARD_ID,
            card: { issuer: "Amex", name: "Gold Card", defaultColor: "#C9A961" },
            lastVerifiedAt: "2026-06-04T00:00:00Z",
            benefitCount: 1,
          },
        ];
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      }
      if (url === "/api/user-cards/uc-existing" && init?.method === "DELETE") {
        cardsState = cardsState.filter((c) => (c as { id: string }).id !== "uc-existing");
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("{}") });
      }
      return Promise.reject(new Error(`unmocked fetch: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText("Freedom")).toBeDefined());

    // --- ADD flow: confirm a fresh card → toast should appear. ---
    fireEvent.click(screen.getByRole("button", { name: /Add a card/ }));
    fireEvent.click(await screen.findByTestId("fake-add-success"));

    const saveBtn = await screen.findByRole("button", { name: /^Save \d+ benefit/ });

    // Guard: toggling a benefit's tracked state in the review flow must NOT toast
    // (benefit tracking is inline-only on the Cards screen — CONSTRAINT-20).
    fireEvent.click(screen.getByRole("button", { name: "Toggle tracked" }));
    expect(screen.queryByTestId("admin-toast")).toBeNull();

    // Confirming the fresh card (the SOLE write path) DOES toast on add.
    fireEvent.click(saveBtn);
    await waitFor(() => {
      const toast = screen.getByTestId("admin-toast");
      expect(toast.textContent).toMatch(/added/i);
    });
  });
});
