import Anthropic from "@anthropic-ai/sdk";
import { BENEFIT_EXTRACTION_TOOL } from "@/lib/parser/schema";
import {
  applyClassificationOverride,
  deriveTracked,
  normalizeClassification,
} from "@/lib/parser/classification";
import type { DraftBenefit } from "@/types/benefit";

const MODEL = "claude-haiku-4-5-20251001"; // CONSTRAINT-09: hardcoded, never substituted

const VALID_TYPES = new Set<DraftBenefit["type"]>([
  "credit",
  "subscription",
  "access",
  "perk",
]);

// Haiku is given this enum in the tool schema but occasionally emits an
// out-of-enum value (e.g. "entertainment" for a Capital One Entertainment
// benefit). Clamp at the LLM boundary so an invalid category never reaches
// the review gate or the confirm validator. Mirrors the VALID_TYPES clamp.
const VALID_CATEGORIES = new Set<DraftBenefit["category"]>([
  "dining",
  "travel",
  "streaming",
  "shopping",
  "lounge",
  "general",
]);

/**
 * Maps one raw LLM benefit to a DraftBenefit. `classification` is normalized,
 * then run through `applyClassificationOverride` so deterministic regex
 * correction (NEW-5 cash-back / NEW-8 trials, pay-over-time, recurring
 * discounts) takes precedence over the LLM bucket. `tracked` is derived from
 * the final classification via deterministic policy — never read from the LLM.
 */
function toDraftBenefit(b: RawBenefit): DraftBenefit {
  const normalized = normalizeClassification(b.classification);
  const description = b.description ?? null;
  const classification = applyClassificationOverride(b.name, description, normalized);
  return {
    name: b.name,
    description,
    type: VALID_TYPES.has(b.type) ? b.type : "perk",
    value: b.value ?? null,
    valueUnit: b.valueUnit === "points" ? "points" : "dollars",
    resetPeriod: b.resetPeriod,
    resetAnchor: b.resetAnchor ?? "calendar", // default per CONSTRAINT-09 / task spec
    category: VALID_CATEGORIES.has(b.category) ? b.category : "general",
    classification,
    tracked: deriveTracked(classification),
    setAndForget: false,
    confidence: b.confidence,
  };
}

/** Thrown when Claude Haiku benefit parsing fails. Includes a preview of the raw input text. */
export class ParserError extends Error {
  rawTextPreview: string;

  constructor({ message, rawTextPreview, cause }: { message: string; rawTextPreview: string; cause?: unknown }) {
    super(message, { cause });
    this.name = "ParserError";
    this.rawTextPreview = rawTextPreview;
  }
}

/** Sends raw scraped text to Claude Haiku and returns structured DraftBenefits via tool_use. */
export async function parseBenefits(rawText: string): Promise<DraftBenefit[]> {
  const client = new Anthropic(); // picks up ANTHROPIC_API_KEY from process.env automatically

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192, // Task 45 (NEW-4): bumped from 4096 after Sapphire Reserve overflow. Probe pending; max_tokens branch below surfaces residual overflow as user-actionable.
      tools: [BENEFIT_EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "extract_benefits" },
      messages: [
        {
          role: "user",
          content:
            "Extract all credit card benefits from the following text.\n\n" + rawText,
        },
      ],
    });
  } catch (err) {
    throw new ParserError({
      message: `Anthropic API call failed: ${err instanceof Error ? err.message : String(err)}`,
      rawTextPreview: rawText.slice(0, 200),
      cause: err,
    });
  }

  debugLog(`output_tokens=${response.usage.output_tokens} stop_reason=${response.stop_reason}`);

  if (response.stop_reason === "max_tokens") {
    // Task 45 (NEW-4): Haiku ran out of room mid-tool_use. User-actionable per EH-02.
    throw new ParserError({
      message: "Card content exceeds parser capacity, manual entry required",
      rawTextPreview: rawText.slice(0, 200),
    });
  }

  if (response.stop_reason !== "tool_use") {
    throw new ParserError({
      message: `Expected stop_reason "tool_use", got "${response.stop_reason}"`,
      rawTextPreview: rawText.slice(0, 200),
    });
  }

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") return [];

  const { benefits } = toolBlock.input as { benefits?: RawBenefit[] };
  if (!benefits?.length) return [];

  return benefits.map(toDraftBenefit);
}

/** Gated debug log — EH-01 (not silent) / EH-02 (context). Visible when DEBUG=true.
 *  Duplicates the pattern in classification.ts intentionally; extract to a shared util
 *  the moment a third consumer needs it (see Task 45 session-log). */
function debugLog(message: string): void {
  if (process.env.DEBUG === "true") {
    console.log("[parser] " + message);
  }
}

type RawBenefit = {
  name: string;
  description?: string;
  type: DraftBenefit["type"];
  value?: number;
  valueUnit?: string;
  resetPeriod: DraftBenefit["resetPeriod"];
  resetAnchor?: DraftBenefit["resetAnchor"];
  category: DraftBenefit["category"];
  classification?: unknown; // raw from LLM; normalized via deriveTracked/normalizeClassification
  confidence: number;
};
