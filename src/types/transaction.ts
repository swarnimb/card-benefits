import type { TransactionModel } from "@/generated/prisma/models/Transaction";
import type { ImportBatchModel } from "@/generated/prisma/models/ImportBatch";
import type { BenefitCategory } from "./card";

// --- Normalized transaction from CSV parsing (before DB storage) ---

export type ParsedTransaction = {
  date: string; // ISO date string
  merchant: string;
  description: string;
  amount: number; // positive = debit, negative = credit
  bankCategory: string | null;
};

// --- Import preview (returned by POST /api/transactions/import) ---

export type ImportPreview = {
  transactions: ParsedTransaction[];
  totalCount: number;
  duplicateCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  detectedBank: string | null;
};

// --- Import confirmation request ---

export type ImportConfirmRequest = {
  userCardId: string;
  transactions: ParsedTransaction[];
  fileName: string;
};

// --- Categorization (LLM response) ---

export type CategoryMap = Record<string, BenefitCategory>;

// --- Transaction with import batch (API response) ---

export type TransactionWithBatch = TransactionModel & {
  importBatch: ImportBatchModel;
};

// --- API response types ---

export type TransactionsResponse = {
  transactions: TransactionModel[];
  totalCount: number;
};

export type ImportConfirmResponse = {
  importBatchId: string;
  transactionCount: number;
  categorized: number;
};
