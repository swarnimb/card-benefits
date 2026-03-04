// --- Column mapping for a bank's CSV format ---

export type CsvColumnMapping = {
  date: string; // column header name for transaction date
  merchant: string; // column header for merchant name
  description: string; // column header for description (may be same as merchant)
  amount: string; // column header for amount
  debit?: string; // separate debit column (some banks split debit/credit)
  credit?: string; // separate credit column
  category?: string; // column header for bank-provided category
};

// --- Bank format definition ---

export type BankFormat = {
  bankName: string;
  displayName: string; // e.g. "Chase", "American Express"
  dateFormat: string; // e.g. "MM/DD/YYYY", "YYYY-MM-DD"
  columns: CsvColumnMapping;
  identifierHeaders: string[]; // headers that uniquely identify this bank's CSV
  amountSign: "positive_debit" | "positive_credit" | "split_columns";
};

// --- Supported banks ---

export type SupportedBank =
  | "chase"
  | "amex"
  | "capital-one"
  | "citi"
  | "boa"
  | "discover"
  | "wells-fargo";

// --- Raw parsed CSV row (from Papa Parse) ---

export type RawCsvRow = Record<string, string>;

// --- Detection result ---

export type BankDetectionResult = {
  bank: SupportedBank;
  format: BankFormat;
  confidence: "exact" | "partial";
} | null;
