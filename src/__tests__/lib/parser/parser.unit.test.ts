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
    // Task 45: parseBenefits reads response.usage.output_tokens for the gated debugLog.
    // Always include `usage` so the read is type-safe even when DEBUG is unset (the log
    // is suppressed but the template literal access still happens).
    usage: { input_tokens: 100, output_tokens: 500 },
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

  it("clamps an out-of-enum category to general, preserves valid ones", async () => {
    // Haiku occasionally emits a category outside its tool-schema enum
    // (e.g. "entertainment" for a Capital One Entertainment benefit). The
    // clamp keeps it from reaching the confirm validator and 400-ing the save.
    const offending = { ...validBenefit, category: "entertainment" };
    const valid = { ...validBenefit, category: "streaming" };
    mockCreate.mockResolvedValue(makeToolUseResponse([offending, valid]));

    const result = await parseBenefits("Entertainment benefit + streaming credit.");
    expect(result[0].category).toBe("general");
    expect(result[1].category).toBe("streaming");
  });

  it("throws ParserError when stop_reason is not tool_use", async () => {
    mockCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [],
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    await expect(parseBenefits("some text")).rejects.toBeInstanceOf(ParserError);
    await expect(parseBenefits("some text")).rejects.toMatchObject({
      name: "ParserError",
      rawTextPreview: "some text",
    });
  });

  it("throws ParserError with user-actionable message when stop_reason is max_tokens", async () => {
    // Task 45 (NEW-4): Haiku runs out of room mid-tool_use on content-rich cards
    // (Sapphire Reserve confirmed pre-bump). The new branch surfaces a user-facing
    // message rather than the generic 'Expected stop_reason "tool_use"' string.
    mockCreate.mockResolvedValue({
      stop_reason: "max_tokens",
      content: [],
      usage: { input_tokens: 1000, output_tokens: 8192 },
    });

    await expect(parseBenefits("some long card text")).rejects.toBeInstanceOf(ParserError);
    await expect(parseBenefits("some long card text")).rejects.toMatchObject({
      name: "ParserError",
      message: "Card content exceeds parser capacity, manual entry required",
      rawTextPreview: "some long card text",
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
