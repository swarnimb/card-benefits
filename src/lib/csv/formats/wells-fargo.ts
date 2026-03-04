import type { BankFormat } from "@/types/csv";

export const wellsFargoFormat: BankFormat = {
  bankName: "wells-fargo",
  displayName: "Wells Fargo",
  dateFormat: "MM/DD/YYYY",
  columns: {
    date: "Transaction Date",
    merchant: "Description",
    description: "Description",
    amount: "Amount",
  },
  identifierHeaders: ["Transaction Date", "Posted Date", "Description", "Amount"],
  // Wells Fargo: negative = purchase, positive = payment/credit
  amountSign: "positive_credit",
};
