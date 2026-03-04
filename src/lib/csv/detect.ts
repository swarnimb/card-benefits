import type { BankDetectionResult, SupportedBank } from "@/types/csv";
import { bankFormats } from "./formats";

/**
 * Detects which bank a CSV belongs to by matching column headers
 * against known bank format definitions.
 *
 * Strategy: score each bank by how many of its identifierHeaders
 * appear in the CSV headers. Exact = all match. Partial = >50% match.
 * Returns the highest-scoring bank, or null if no match exceeds 50%.
 */
export function detectBank(csvHeaders: string[]): BankDetectionResult {
  const normalizedHeaders = new Set(
    csvHeaders.map((h) => h.trim().toLowerCase())
  );

  let bestBank: SupportedBank | null = null;
  let bestScore = 0;
  let bestTotal = 0;

  for (const [bankKey, format] of Object.entries(bankFormats)) {
    const identifiers = format.identifierHeaders;
    const matched = identifiers.filter((id) =>
      normalizedHeaders.has(id.toLowerCase())
    ).length;

    const score = matched / identifiers.length;

    if (score > bestScore) {
      bestScore = score;
      bestBank = bankKey as SupportedBank;
      bestTotal = identifiers.length;
    }
  }

  if (!bestBank || bestScore <= 0.5) {
    return null;
  }

  return {
    bank: bestBank,
    format: bankFormats[bestBank],
    confidence: bestScore === 1 ? "exact" : "partial",
  };
}
