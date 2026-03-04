import type { BankFormat } from "@/types/csv";

export const capitalOneFormat: BankFormat = {
  bankName: "capital-one",
  displayName: "Capital One",
  dateFormat: "YYYY-MM-DD",
  columns: {
    date: "Transaction Date",
    merchant: "Description",
    description: "Description",
    amount: "Debit", // primary amount column — use debit
    debit: "Debit",
    credit: "Credit",
    category: "Category",
  },
  // "Card No." is unique to Capital One exports
  identifierHeaders: ["Transaction Date", "Posted Date", "Card No.", "Description", "Category", "Debit", "Credit"],
  // Capital One: separate Debit and Credit columns
  amountSign: "split_columns",
};
