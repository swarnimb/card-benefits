import type { BankFormat } from "@/types/csv";

export const discoverFormat: BankFormat = {
  bankName: "discover",
  displayName: "Discover",
  dateFormat: "MM/DD/YYYY",
  columns: {
    date: "Trans. Date",
    merchant: "Description",
    description: "Description",
    amount: "Amount",
    category: "Category",
  },
  // "Trans. Date" (abbreviated) is distinctive to Discover
  identifierHeaders: ["Trans. Date", "Post Date", "Description", "Amount", "Category"],
  // Discover: positive = purchase, negative = credit
  amountSign: "positive_debit",
};
