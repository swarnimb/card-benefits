import type { BankFormat } from "@/types/csv";

export const chaseFormat: BankFormat = {
  bankName: "chase",
  displayName: "Chase",
  dateFormat: "MM/DD/YYYY",
  columns: {
    date: "Transaction Date",
    merchant: "Description",
    description: "Description",
    amount: "Amount",
    category: "Category",
  },
  // Chase CSVs include "Type" (Sale/Payment) — unique to Chase
  identifierHeaders: ["Transaction Date", "Post Date", "Description", "Category", "Type", "Amount"],
  // Chase: negative = purchase, positive = payment/credit
  amountSign: "positive_credit",
};
