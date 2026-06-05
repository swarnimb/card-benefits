import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Card } from "@prisma/client";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before vi.mock factories close over them.
// ---------------------------------------------------------------------------
const { mockReadFileSync, mockCardUpdate } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockCardUpdate: vi.fn(),
}));

vi.mock("fs", () => ({
  readFileSync: mockReadFileSync,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    card: {
      update: mockCardUpdate,
    },
  },
}));

// Module-under-test — imported after vi.mock blocks.
import { resyncCardFromCatalog } from "@/lib/catalog/resync";

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: "ckcuidabc123",
  issuer: "Amex",
  name: "Gold Card",
  scrapeUrl: "https://old.example.com/gold",
  defaultColor: "#000000",
  annualFee: null,
  ...overrides,
});

const catalogJson = (entries: unknown[]) => JSON.stringify(entries);

beforeEach(() => {
  mockReadFileSync.mockReset();
  mockCardUpdate.mockReset();
  // Default: silence console.error noise; individual tests can override.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("resyncCardFromCatalog", () => {
  it("updates DB and returns new row when catalog scrapeUrl differs", async () => {
    const card = makeCard({
      scrapeUrl: "https://old.example.com/gold",
      defaultColor: "#000000",
    });
    mockReadFileSync.mockReturnValue(
      catalogJson([
        {
          id: "amex-gold",
          issuer: "Amex",
          name: "Gold Card",
          scrapeUrl: "NEW_URL",
          defaultColor: "#B8952A",
        },
      ])
    );
    const updated = { ...card, scrapeUrl: "NEW_URL", defaultColor: "#B8952A" };
    mockCardUpdate.mockResolvedValue(updated);

    const result = await resyncCardFromCatalog(card);

    expect(result.scrapeUrl).toBe("NEW_URL");
    expect(result.defaultColor).toBe("#B8952A");
    expect(mockCardUpdate).toHaveBeenCalledTimes(1);
    expect(mockCardUpdate).toHaveBeenCalledWith({
      where: { id: card.id },
      data: { scrapeUrl: "NEW_URL", defaultColor: "#B8952A" },
    });
  });

  it("returns input and skips DB write when catalog matches", async () => {
    const card = makeCard({
      scrapeUrl: "https://same.example.com",
      defaultColor: "#B8952A",
    });
    mockReadFileSync.mockReturnValue(
      catalogJson([
        {
          id: "amex-gold",
          issuer: "Amex",
          name: "Gold Card",
          scrapeUrl: "https://same.example.com",
          defaultColor: "#B8952A",
        },
      ])
    );

    const result = await resyncCardFromCatalog(card);

    expect(result).toEqual(card);
    expect(mockCardUpdate).not.toHaveBeenCalled();
  });

  it("returns input unchanged for a custom card with no catalog match", async () => {
    const card = makeCard({
      issuer: "Other",
      name: "My Custom Card",
      scrapeUrl: null,
      defaultColor: "#64748b",
    });
    mockReadFileSync.mockReturnValue(
      catalogJson([
        {
          id: "amex-gold",
          issuer: "Amex",
          name: "Gold Card",
          scrapeUrl: "https://example.com",
          defaultColor: "#B8952A",
        },
      ])
    );

    const result = await resyncCardFromCatalog(card);

    expect(result).toBe(card);
    expect(mockCardUpdate).not.toHaveBeenCalled();
  });

  it("logs and returns input unchanged when prisma.card.update throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const card = makeCard({
      scrapeUrl: "https://old.example.com/gold",
      defaultColor: "#000000",
    });
    mockReadFileSync.mockReturnValue(
      catalogJson([
        {
          id: "amex-gold",
          issuer: "Amex",
          name: "Gold Card",
          scrapeUrl: "NEW_URL",
          defaultColor: "#B8952A",
        },
      ])
    );
    mockCardUpdate.mockRejectedValue(new Error("DB exploded"));

    const result = await resyncCardFromCatalog(card);

    expect(result).toBe(card);
    expect(errorSpy).toHaveBeenCalled();
    const firstArg = errorSpy.mock.calls[0][0];
    expect(typeof firstArg).toBe("string");
    expect(firstArg as string).toMatch(/^\[catalog-resync\]/);
  });
});
