import type { BankFormat } from "@/types/csv";

export const citiFormat: BankFormat = {
  bankName: "citi",
  displayName: "Citi",
  dateFormat: "MM/DD/YYYY",
  columns: {
    date: "Date",
    merchant: "Description",
    description: "Description",
    amount: "Debit", // primary amount column — use debit
    debit: "Debit",
    credit: "Credit",
  },
  // "Status" column is unique to Citi exports
  identifierHeaders: ["Status", "Date", "Description", "Debit", "Credit"],
  // Citi: separate Debit and Credit columns
  amountSign: "split_columns",
};
