import type { BankFormat } from "@/types/csv";

export const amexFormat: BankFormat = {
  bankName: "amex",
  displayName: "American Express",
  dateFormat: "MM/DD/YYYY",
  columns: {
    date: "Date",
    merchant: "Description",
    description: "Description",
    amount: "Amount",
    category: "Category",
  },
  // "Appears On Your Statement As" and "Card Member" are unique to Amex exports
  identifierHeaders: ["Date", "Description", "Card Member", "Account #", "Amount", "Category", "Appears On Your Statement As"],
  // Amex: positive = charge/purchase, negative = credit/payment
  amountSign: "positive_debit",
};
