import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("framer-motion", () => import("../overview/_mock-framer-motion"));

import { ManagedRow, type ManagedCard } from "@/components/admin/managed-row";
import type { BenefitWithPeriod } from "@/types/benefit";

const CARD: ManagedCard = {
  id: "uc-1",
  card: { issuer: "Chase", name: "Sapphire Reserve", defaultColor: "#3B5BDB" },
  lastVerifiedAt: null,
  benefitCount: 2,
};

const BENEFITS: BenefitWithPeriod[] = [
  {
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
  },
  {
    id: "b-2",
    userCardId: "uc-1",
    name: "Travel Credit",
    description: null,
    type: "credit",
    value: 300,
    valueUnit: "dollars",
    resetPeriod: "annual",
    resetAnchor: "calendar",
    category: "travel",
    classification: "discretionary-credit",
    source: "manual",
    tracked: true,
    setAndForget: false,
    activatedAt: null,
    createdAt: new Date("2026-01-01"),
    currentPeriod: null,
  },
];

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

describe("ManagedRow expand", () => {
  it("does not fetch benefits while collapsed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ManagedRow card={CARD} onRescrape={vi.fn()} onRemove={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expands and lists each benefit with Edit/Delete + an Add action", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(BENEFITS) }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ManagedRow card={CARD} onRescrape={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Expand benefits/ }));

    await waitFor(() => expect(screen.getByText("Dining Credit")).toBeDefined());
    expect(screen.getByText("Travel Credit")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Add benefit/ })).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/user-cards/uc-1/benefits");
  });

  it("shows an inline error (not an empty list) when the benefits fetch fails", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ManagedRow card={CARD} onRescrape={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Expand benefits/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/Could not load benefits/)).toBeDefined();
    // EH-01: must NOT silently show the empty-state copy.
    expect(screen.queryByText("No benefits yet")).toBeNull();
  });

  it("preserves the re-scrape and remove actions", () => {
    vi.stubGlobal("fetch", vi.fn());
    const onRescrape = vi.fn();
    render(<ManagedRow card={CARD} onRescrape={onRescrape} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh benefits for Sapphire Reserve" }));
    expect(onRescrape).toHaveBeenCalledWith("uc-1");
  });
});
