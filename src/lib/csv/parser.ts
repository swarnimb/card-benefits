import Papa from "papaparse";
import type { BankFormat, RawCsvRow } from "@/types/csv";
import type { ParsedTransaction } from "@/types/transaction";
import { detectBank } from "./detect";

type ParseResult = {
  transactions: ParsedTransaction[];
  detectedBank: string | null;
  confidence: "exact" | "partial" | null;
  errors: string[];
};

/**
 * Parses a CSV string, auto-detects the bank format, and normalizes
 * rows into ParsedTransaction objects.
 */
export function parseCsv(csvString: string): ParseResult {
  const errors: string[] = [];

  // Step 1: Parse raw CSV with Papa Parse
  const parsed = Papa.parse<RawCsvRow>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    const critical = parsed.errors.filter((e) => e.type === "Delimiter");
    if (critical.length > 0) {
      return {
        transactions: [],
        detectedBank: null,
        confidence: null,
        errors: critical.map((e) => `Row ${e.row}: ${e.message}`),
      };
    }
    // Non-critical errors — log but continue
    for (const e of parsed.errors) {
      errors.push(`Row ${e.row}: ${e.message}`);
    }
  }

  if (parsed.data.length === 0) {
    return {
      transactions: [],
      detectedBank: null,
      confidence: null,
      errors: ["CSV contains no data rows"],
    };
  }

  // Step 2: Detect bank from headers
  const headers = parsed.meta.fields ?? [];
  const detection = detectBank(headers);

  if (!detection) {
    return {
      transactions: [],
      detectedBank: null,
      confidence: null,
      errors: [
        `Could not detect bank format. Headers found: ${headers.join(", ")}`,
      ],
    };
  }

  // Step 3: Normalize rows using detected format
  const transactions = normalizeRows(parsed.data, detection.format, errors);

  return {
    transactions,
    detectedBank: detection.format.displayName,
    confidence: detection.confidence,
    errors,
  };
}

/**
 * Converts raw CSV rows into normalized ParsedTransaction objects
 * using the bank's column mapping and amount sign convention.
 */
function normalizeRows(
  rows: RawCsvRow[],
  format: BankFormat,
  errors: string[]
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const { columns, amountSign, dateFormat } = format;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Extract fields using column mapping
    const rawDate = row[columns.date]?.trim();
    const merchant = row[columns.merchant]?.trim() ?? "";
    const description = row[columns.description]?.trim() ?? merchant;
    const bankCategory = columns.category
      ? row[columns.category]?.trim() ?? null
      : null;

    if (!rawDate) {
      errors.push(`Row ${i + 1}: missing date — skipped`);
      continue;
    }

    // Parse date to ISO string
    const isoDate = parseDate(rawDate, dateFormat);
    if (!isoDate) {
      errors.push(`Row ${i + 1}: invalid date "${rawDate}" — skipped`);
      continue;
    }

    // Parse amount based on bank's sign convention
    const amount = parseAmount(row, columns, amountSign);
    if (amount === null) {
      errors.push(`Row ${i + 1}: invalid amount — skipped`);
      continue;
    }

    // Skip zero-amount rows (e.g. pending authorizations that resolved)
    if (amount === 0) continue;

    transactions.push({
      date: isoDate,
      merchant,
      description,
      amount,
      bankCategory,
    });
  }

  return transactions;
}

/**
 * Parses a date string into ISO format (YYYY-MM-DD) based on
 * the bank's known date format.
 */
function parseDate(raw: string, dateFormat: string): string | null {
  let year: string, month: string, day: string;

  if (dateFormat === "MM/DD/YYYY") {
    const parts = raw.split("/");
    if (parts.length !== 3) return null;
    [month, day, year] = parts;
  } else if (dateFormat === "YYYY-MM-DD") {
    const parts = raw.split("-");
    if (parts.length !== 3) return null;
    [year, month, day] = parts;
  } else {
    return null;
  }

  // Validate ranges
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Extracts and normalizes the transaction amount.
 * Output convention: positive = debit (money spent), negative = credit (refund/payment).
 */
function parseAmount(
  row: RawCsvRow,
  columns: BankFormat["columns"],
  amountSign: BankFormat["amountSign"]
): number | null {
  if (amountSign === "split_columns") {
    const debitStr = row[columns.debit ?? ""]?.trim();
    const creditStr = row[columns.credit ?? ""]?.trim();
    const debit = parseNumeric(debitStr);
    const credit = parseNumeric(creditStr);

    if (debit !== null && debit !== 0) return Math.abs(debit);
    if (credit !== null && credit !== 0) return -Math.abs(credit);

    // Both empty or zero — invalid
    if (debit === null && credit === null) return null;
    return 0;
  }

  const rawAmount = row[columns.amount]?.trim();
  const amount = parseNumeric(rawAmount);
  if (amount === null) return null;

  if (amountSign === "positive_debit") {
    // Positive = purchase (already correct), negative = credit (already correct)
    return amount;
  }

  if (amountSign === "positive_credit") {
    // Bank flips sign: positive = payment/credit, negative = purchase
    // Invert to match our convention
    return -amount;
  }

  return null;
}

/**
 * Strips currency symbols, commas, and parses to float.
 * Returns null if the string is empty or not a number.
 */
function parseNumeric(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
