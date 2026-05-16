import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { parseBenefits, ParserError } from "@/lib/parser/index";

function makeToolUseResponse(benefits: unknown[]) {
  return {
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "tu_1",
        name: "extract_benefits",
        input: { benefits },
      },
    ],
  };
}

const validBenefit = {
  name: "Dining Credit",
  description: "$10 monthly dining statement credit",
  type: "credit",
  value: 10,
  resetPeriod: "monthly",
  resetAnchor: "calendar",
  category: "dining",
  classification: "discretionary-credit",
  confidence: 0.92,
};

beforeEach(() => {
  mockCreate.mockReset();
});

describe("parseBenefits", () => {
  it("returns DraftBenefit[] for a valid tool_use response", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse([validBenefit]));

    const result = await parseBenefits("Monthly $10 dining credit.");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Dining Credit");
    expect(result[0].type).toBe("credit");
    expect(result[0].value).toBe(10);
    expect(result[0].resetAnchor).toBe("calendar");
    expect(result[0].confidence).toBe(0.92);
  });

  it("maps classification and derives tracked=true for discretionary-credit", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse([validBenefit]));

    const result = await parseBenefits("Monthly $10 dining credit.");
    expect(result[0].classification).toBe("discretionary-credit");
    expect(result[0].tracked).toBe(true);
    // tracked is policy-derived, never read from the LLM payload
    expect("isTrackable" in result[0]).toBe(false);
  });

  it("derives tracked=false for auto-earn", async () => {
    mockCreate.mockResolvedValue(
      makeToolUseResponse([{ ...validBenefit, classification: "auto-earn" }])
    );

    const result = await parseBenefits("Earn 3x points on dining.");
    expect(result[0].classification).toBe("auto-earn");
    expect(result[0].tracked).toBe(false);
  });

  it("normalizes missing/invalid classification to discretionary-credit tracked=true", async () => {
    const missing = { ...validBenefit };
    delete (missing as { classification?: string }).classification;
    const invalid = { ...validBenefit, classification: "lifestyle" };
    mockCreate.mockResolvedValue(makeToolUseResponse([missing, invalid]));

    const result = await parseBenefits("Ambiguous benefit text.");
    for (const b of result) {
      expect(b.classification).toBe("discretionary-credit");
      expect(b.tracked).toBe(true);
    }
  });

  it("throws ParserError when stop_reason is not tool_use", async () => {
    mockCreate.mockResolvedValue({ stop_reason: "end_turn", content: [] });

    await expect(parseBenefits("some text")).rejects.toBeInstanceOf(ParserError);
    await expect(parseBenefits("some text")).rejects.toMatchObject({
      name: "ParserError",
      rawTextPreview: "some text",
    });
  });

  it("returns [] when model returns 0 benefits", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse([]));

    const result = await parseBenefits("No benefits found in this text.");
    expect(result).toEqual([]);
  });

  it("defaults resetAnchor to calendar when omitted by model", async () => {
    const benefitWithoutAnchor = { ...validBenefit };
    delete (benefitWithoutAnchor as { resetAnchor?: string }).resetAnchor;
    mockCreate.mockResolvedValue(makeToolUseResponse([benefitWithoutAnchor]));

    const result = await parseBenefits("Monthly dining credit.");
    expect(result[0].resetAnchor).toBe("calendar");
  });

  it("throws ParserError with rawTextPreview when API call fails", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

    const longText = "A".repeat(500);
    await expect(parseBenefits(longText)).rejects.toMatchObject({
      name: "ParserError",
      rawTextPreview: "A".repeat(200), // sliced to 200
    });
  });
});
