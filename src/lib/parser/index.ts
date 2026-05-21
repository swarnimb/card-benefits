import Anthropic from "@anthropic-ai/sdk";
import { BENEFIT_EXTRACTION_TOOL } from "@/lib/parser/schema";
import {
  applyAutoEarnOverride,
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

/**
 * Maps one raw LLM benefit to a DraftBenefit. `classification` is normalized,
 * then run through `applyAutoEarnOverride` so deterministic regex correction
 * (NEW-5: Haiku misclassifying cash-back rates as credits) takes precedence
 * over the LLM bucket. `tracked` is derived from the final classification via
 * deterministic policy — never read from the LLM.
 */
function toDraftBenefit(b: RawBenefit): DraftBenefit {
  const normalized = normalizeClassification(b.classification);
  const description = b.description ?? null;
  const classification = applyAutoEarnOverride(b.name, description, normalized);
  return {
    name: b.name,
    description,
    type: VALID_TYPES.has(b.type) ? b.type : "perk",
    value: b.value ?? null,
    valueUnit: b.valueUnit === "points" ? "points" : "dollars",
    resetPeriod: b.resetPeriod,
    resetAnchor: b.resetAnchor ?? "calendar", // default per CONSTRAINT-09 / task spec
    category: b.category,
    classification,
    tracked: deriveTracked(classification),
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
      max_tokens: 4096,
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
