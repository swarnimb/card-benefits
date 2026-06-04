import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { parseBenefits, ParserError, toConfidenceTier } from "@/lib/parser/index";

function makeToolUseResponse(benefits: unknown[], input: Record<string, unknown> = {}) {
  return {
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "tu_1",
        name: "extract_benefits",
        input: { benefits, ...input },
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

    const { benefits } = await parseBenefits("Monthly $10 dining credit.");
    expect(benefits).toHaveLength(1);
    expect(benefits[0].name).toBe("Dining Credit");
    expect(benefits[0].type).toBe("credit");
    expect(benefits[0].value).toBe(10);
    expect(benefits[0].resetAnchor).toBe("calendar");
    // Task 59: 0.92 score (>= 0.80 threshold) maps to the 'high' review tier.
    expect(benefits[0].confidence).toBe("high");
  });

  it("maps classification and derives tracked=true for discretionary-credit", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse([validBenefit]));

    const { benefits } = await parseBenefits("Monthly $10 dining credit.");
    expect(benefits[0].classification).toBe("discretionary-credit");
    expect(benefits[0].tracked).toBe(true);
    // tracked is policy-derived, never read from the LLM payload
    expect("isTrackable" in benefits[0]).toBe(false);
  });

  it("derives tracked=false for auto-earn", async () => {
    mockCreate.mockResolvedValue(
      makeToolUseResponse([{ ...validBenefit, classification: "auto-earn" }])
    );

    const { benefits } = await parseBenefits("Earn 3x points on dining.");
    expect(benefits[0].classification).toBe("auto-earn");
    expect(benefits[0].tracked).toBe(false);
  });

  it("normalizes missing/invalid classification to discretionary-credit tracked=true", async () => {
    const missing = { ...validBenefit };
    delete (missing as { classification?: string }).classification;
    const invalid = { ...validBenefit, classification: "lifestyle" };
    mockCreate.mockResolvedValue(makeToolUseResponse([missing, invalid]));

    const { benefits } = await parseBenefits("Ambiguous benefit text.");
    for (const b of benefits) {
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

    const { benefits } = await parseBenefits("Entertainment benefit + streaming credit.");
    expect(benefits[0].category).toBe("general");
    expect(benefits[1].category).toBe("streaming");
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

    const { benefits } = await parseBenefits("No benefits found in this text.");
    expect(benefits).toEqual([]);
  });

  it("defaults resetAnchor to calendar when omitted by model", async () => {
    const benefitWithoutAnchor = { ...validBenefit };
    delete (benefitWithoutAnchor as { resetAnchor?: string }).resetAnchor;
    mockCreate.mockResolvedValue(makeToolUseResponse([benefitWithoutAnchor]));

    const { benefits } = await parseBenefits("Monthly dining credit.");
    expect(benefits[0].resetAnchor).toBe("calendar");
  });

  it("returns annualFee when present in tool output", async () => {
    // Card-level annualFee (Task 58): Haiku returns it as a sibling of `benefits`.
    mockCreate.mockResolvedValue(makeToolUseResponse([validBenefit], { annualFee: 550 }));

    const { benefits, annualFee } = await parseBenefits("Annual fee $550. Monthly $10 dining credit.");
    expect(annualFee).toBe(550);
    expect(benefits).toHaveLength(1); // benefits still flow through unchanged
  });

  it("returns annualFee null when omitted", async () => {
    // A11 fallback: no annualFee key in the tool input → result carries null.
    mockCreate.mockResolvedValue(makeToolUseResponse([validBenefit]));

    const { annualFee } = await parseBenefits("Monthly $10 dining credit.");
    expect(annualFee).toBeNull();
  });

  it("throws ParserError with rawTextPreview when API call fails", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

    const longText = "A".repeat(500);
    await expect(parseBenefits(longText)).rejects.toMatchObject({
      name: "ParserError",
      rawTextPreview: "A".repeat(200), // sliced to 200
    });
  });

  it("tags a low-confidence benefit (<0.80) as confidence: 'low' and passes the note through", async () => {
    // Task 59: Haiku returns a numeric score; the tier is decided in code, not by
    // the LLM. A 0.65 score sits below the 0.80 threshold → 'low'. The reviewer
    // note flows through to the review gate verbatim.
    const lowConf = {
      ...validBenefit,
      confidence: 0.65,
      note: "reset period inferred from 'per year' wording",
    };
    mockCreate.mockResolvedValue(makeToolUseResponse([lowConf]));

    const { benefits } = await parseBenefits("Ambiguous yearly credit.");
    expect(benefits[0].confidence).toBe("low");
    expect(benefits[0].note).toBe("reset period inferred from 'per year' wording");
  });

  it("defaults a benefit with missing confidence to 'low' with no note", async () => {
    // Error/missing case: Haiku omitted the (non-required) confidence score and
    // gave no note. Parser must default the tier to 'low' (flag for review) and
    // leave `note` undefined rather than throwing.
    const noConf = { ...validBenefit };
    delete (noConf as { confidence?: number }).confidence;
    mockCreate.mockResolvedValue(makeToolUseResponse([noConf]));

    const { benefits } = await parseBenefits("Credit with no score.");
    expect(benefits[0].confidence).toBe("low");
    expect(benefits[0].note).toBeUndefined();
  });

  it("toConfidenceTier maps scores deterministically around the 0.80 threshold", async () => {
    // Pure deterministic mapping — exported so the threshold can be asserted
    // directly, independent of any Haiku payload.
    expect(toConfidenceTier(0.95)).toBe("high");
    expect(toConfidenceTier(0.8)).toBe("high"); // boundary is inclusive of 0.80
    expect(toConfidenceTier(0.79)).toBe("low");
    expect(toConfidenceTier(undefined)).toBe("low");
    expect(toConfidenceTier(NaN)).toBe("low");
  });
});
