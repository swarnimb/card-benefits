import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

// AddPicker animates rows with framer-motion — mock it so list items render
// synchronously and entrance animations don't gate visibility.
vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { AddPicker } from "@/components/admin/add-picker";

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
    const resp = (key && merged[key]) || { status: 404, json: { error: "Not found" } };
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      json: () => Promise.resolve(resp.json),
    });
  }));
}

describe("AddPicker", () => {
  it("shows duplicate message on 409 response", async () => {
    mockFetch({
      "/api/user-cards": { status: 409, json: { error: "You already have this card" } },
    });

    render(<AddPicker onClose={vi.fn()} onAdded={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Sapphire Reserve")).toBeDefined());

    fireEvent.click(screen.getByText("Sapphire Reserve"));

    await waitFor(() => expect(screen.getByText("Already added")).toBeDefined());
  });

  it("calls onAdded after a successful catalog add", async () => {
    mockFetch();
    const onAdded = vi.fn();

    render(<AddPicker onClose={vi.fn()} onAdded={onAdded} />);

    await waitFor(() => expect(screen.getByText("Sapphire Reserve")).toBeDefined());

    fireEvent.click(screen.getByText("Sapphire Reserve"));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith("uc-new"));
  });

  it("preserves the custom-card add path (issuer + name → POST)", async () => {
    mockFetch();
    const onAdded = vi.fn();

    render(<AddPicker onClose={vi.fn()} onAdded={onAdded} />);

    await waitFor(() => expect(screen.getByText("Sapphire Reserve")).toBeDefined());

    // Reveal the custom-card sub-form.
    fireEvent.click(screen.getByRole("button", { name: /add a custom card/i }));

    const addButton = screen.getByRole("button", { name: /add custom card/i });
    expect(addButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Custom issuer"), {
      target: { value: "US Bank" },
    });
    // Still disabled until name is filled too.
    expect(addButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Custom card name"), {
      target: { value: "Altitude Go" },
    });
    expect(addButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(addButton);
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith("uc-new"));
  });
});
