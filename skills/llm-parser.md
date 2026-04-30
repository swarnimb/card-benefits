# Skill: @llm-parser

## Purpose
Parses raw benefit text (from `@scraper` output) into structured benefit records using Claude API (Haiku). Uses `tool_use` for structured output — never freeform text. Scores confidence per benefit, validates all fields, and gates all output behind user review. Never writes to the database directly — produces a reviewable draft only.

---

## Modes

### `@llm-parser` (reference)
Shows the benefit schema and current model configuration.

### `@llm-parser [ScrapeResult]`
Parses a single card's scraped output into a typed `ParseResult`. Returns draft for user review.

### `@llm-parser batch [ScrapeResult[]]`
Parses multiple cards sequentially. Returns all `ParseResult[]` together for a combined review gate.

---

## Pre-conditions

1. Read `manifest.md` — confirm Claude Haiku is the configured model
2. `@scraper` output (`ScrapeResult`) must be provided — never call Claude on raw unstructured text directly
3. `ANTHROPIC_API_KEY` must be set in `.env`
4. Validation schema must be checked against before returning output

---

## Benefit Schema (Output Target)

Source of truth: `src/types/benefit.ts` → `DraftBenefit`. Do not use enum values from this file without cross-checking that type.

```typescript
// DraftBenefit — matches src/types/benefit.ts exactly
type DraftBenefit = {
  name: string                                              // Short display name
  description: string | null                               // Full description (optional)
  type: 'credit' | 'subscription' | 'access' | 'perk'
  value: number | null                                     // Dollar amount or count. null for unlimited.
  resetPeriod: 'monthly' | 'quarterly' | 'annual' | 'once'  // NOT 'yearly'/'none'
  resetAnchor: 'calendar' | 'statement' | 'anniversary'     // NOT 'statement_date'
  category: 'dining' | 'travel' | 'streaming' | 'shopping' | 'lounge' | 'general'  // NOT 'lifestyle'/'other'
  isTrackable: boolean
  confidence: number                                       // 0.0–1.0
}
```

Tool schema lives in `src/lib/parser/schema.ts` → `BENEFIT_EXTRACTION_TOOL`.
Parser implementation: `src/lib/parser/index.ts` → `parseBenefits(rawText: string): Promise<DraftBenefit[]>`.

---

## Process

### Single card parse

1. Construct prompt from `ScrapeResult.raw_sections` — provide section heading + content per benefit area
2. Define `ParsedBenefit` as a Claude `tool_use` tool schema — structured output, not freeform
3. Call Claude Haiku with `tool_use` — extract each discrete benefit as a separate tool call result
4. Score confidence per benefit:
   - All fields clearly and explicitly stated in source text → 0.85–0.95
   - Value present but reset period inferred → 0.70–0.84
   - Benefit exists but key details ambiguous → 0.40–0.69
5. Run validation pass on Claude's response (see Validation below)
6. Return `ParseResult` — do NOT write to database

### Prompt construction rules

- Provide each section as: `"Section: [heading]\nContent: [content]"`
- Instruct Claude: extract each discrete benefit as a separate item
- Instruct Claude: if a field is unclear, lower the confidence score rather than guessing
- Instruct Claude: `value` must always be a number — no currency symbols, no strings
- Instruct Claude: `resetPeriod` must be one of the exact enum values — no paraphrasing
- Include the full tool schema definition as the tool definition in the API call

### Validation (handled by parser)

`parseBenefits` in `src/lib/parser/index.ts` handles this. Key behaviours:
- `stop_reason !== "tool_use"` → throws `ParserError`
- `resetAnchor` missing → defaults to `"calendar"` (safe default per assumptions)
- 0 benefits returned → returns `[]` (valid, not an error)
- API failure → throws `ParserError` with `rawTextPreview` (first 200 chars of rawText)

---

## Confidence Thresholds

| Range | Color in UI | Treatment |
|---|---|---|
| ≥ 0.85 | Green | Surfaced in review, user can confirm as-is |
| 0.70–0.84 | Amber | Surfaced in review, specific low-confidence fields highlighted |
| < 0.70 | Red | Flagged — user must actively edit before confirming |

Low-confidence benefits are NOT blocked from saving — they are flagged so the user makes an informed decision.

---

## Review Gate (Mandatory)

`ParseResult` is **NEVER** written to the database without explicit user confirmation.

The review UI (built by `@dev` / `@ui`) must:
- Show every parsed benefit with all fields visible and editable
- Display confidence per benefit as a color-coded indicator
- Highlight individual low-confidence fields (not just the benefit as a whole)
- Allow user to edit any field inline before confirming
- Allow user to delete any benefit before confirming
- Require explicit "Confirm & Save" — no auto-save, no save-on-navigate
- Call `@data` to write confirmed benefits to DB only after user confirmation

---

## Output Format

```typescript
type ParseResult = {
  card_id: string
  parsed_at: string               // ISO timestamp
  model: 'claude-haiku-4-5-20251001'
  benefits: ParsedBenefit[]
  flagged_count: number           // benefits with confidence < 0.70
  validation_errors: Array<{
    benefit_index: number
    field: string
    reason: string
  }>
  failed_sections: string[]       // section headings that produced no parseable benefits
}
```

---

## When To Invoke

- After `@scraper` returns a `ScrapeResult` with `status: 'success'`
- When user manually triggers re-parse of a card after correcting scraped text
- For any new card benefit ingestion flow

## When Not To Invoke

- For writing confirmed benefits to the database — that is `@data`
- For transaction categorization (future feature — separate invocation, separate prompt)
- When `ScrapeResult.status` is not `'success'` — fix the scrape first
- For cards where benefits were manually entered — do not re-parse over user data without explicit re-scrape

---

## Closing

After parsing: "Parsed [N] benefits for [card name]. [N] flagged (confidence < 0.70). [N] validation errors. Surface all to user via review gate. After user confirms, call `@data` to write to database."
