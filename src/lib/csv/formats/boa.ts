import type { BankFormat } from "@/types/csv";

export const boaFormat: BankFormat = {
  bankName: "boa",
  displayName: "Bank of America",
  dateFormat: "MM/DD/YYYY",
  columns: {
    date: "Posted Date",
    merchant: "Payee",
    description: "Payee",
    amount: "Amount",
  },
  // "Reference Number" and "Payee" are unique to BoA exports
  identifierHeaders: ["Posted Date", "Reference Number", "Payee", "Address", "Amount"],
  // BoA: negative = purchase, positive = payment/credit
  amountSign: "positive_credit",
};
