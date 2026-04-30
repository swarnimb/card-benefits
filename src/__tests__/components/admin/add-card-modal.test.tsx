import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { AddCardModal } from "@/components/admin/add-card-modal";

afterEach(() => cleanup());

const CATALOG = [
  { id: "chase-sapphire-reserve", issuer: "Chase", name: "Sapphire Reserve", scrapeUrl: null, defaultColor: "#1a56db" },
  { id: "amex-gold", issuer: "Amex", name: "Gold Card", scrapeUrl: null, defaultColor: "#B8952A" },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(overrides?: Partial<Record<string, { status: number; json: unknown }>>) {
  const defaults: Record<string, { status: number; json: unknown }> = {
    "/api/catalog": { status: 200, json: CATALOG },
    "/api/user-cards": { status: 201, json: { id: "uc-new" } },
  };
  const merged = { ...defaults, ...overrides };

  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const key = Object.keys(merged).find((k) => url.endsWith(k));
    const resp = key ? merged[key] : { status: 404, json: { error: "Not found" } };
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      json: () => Promise.resolve(resp.json),
    });
  }));
}

describe("AddCardModal", () => {
  it("shows duplicate message on 409 response", async () => {
    mockFetch({
      "/api/user-cards": { status: 409, json: { error: "You already have this card" } },
    });

    render(<AddCardModal open onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Chase")).toBeDefined());

    fireEvent.click(screen.getByText("Chase"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByText("You already have this card")).toBeDefined()
    );
  });

  it("disables custom Add button when name is empty", async () => {
    mockFetch();

    render(<AddCardModal open onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Custom Card")).toBeDefined());

    const addButton = screen.getByRole("button", { name: "Add Custom Card" });
    expect(addButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Issuer (e.g. US Bank)"), {
      target: { value: "US Bank" },
    });

    expect(addButton.hasAttribute("disabled")).toBe(true);
  });

  it("calls onSuccess and onClose after successful catalog add", async () => {
    mockFetch();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<AddCardModal open onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => expect(screen.getByText("Chase")).toBeDefined());

    fireEvent.click(screen.getByText("Chase"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("uc-new");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("enables custom Add button when both fields filled", async () => {
    mockFetch();

    render(<AddCardModal open onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Custom Card")).toBeDefined());

    const addButton = screen.getByRole("button", { name: "Add Custom Card" });

    fireEvent.change(screen.getByPlaceholderText("Issuer (e.g. US Bank)"), {
      target: { value: "US Bank" },
    });
    fireEvent.change(screen.getByPlaceholderText("Card name"), {
      target: { value: "Altitude Go" },
    });

    expect(addButton.hasAttribute("disabled")).toBe(false);
  });
});
