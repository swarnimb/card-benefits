/** Claude tool_use schema for structured benefit extraction. Defines the extract_benefits tool. */
export const BENEFIT_EXTRACTION_TOOL = {
  name: "extract_benefits",
  description:
    "Extract all credit card benefits from the provided text. " +
    "Extract each discrete benefit as a separate item. " +
    "If a field is unclear, lower the confidence score rather than guessing. " +
    "The value field must always be a number — no currency symbols or strings.",
  input_schema: {
    type: "object" as const,
    properties: {
      annualFee: {
        type: ["number", "null"],
        description:
          "The card's annual fee in USD as a plain number (e.g. 95, 550, 0). " +
          "This is a CARD-LEVEL field, not a per-benefit field. " +
          "Return null if the annual fee is not stated in the text.",
      },
      benefits: {
        type: "array",
        description: "All benefits extracted from the text",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Short display name for the benefit (max 40 characters)",
            },
            description: {
              type: "string",
              description: "Full description including conditions, restrictions, and enrollment requirements",
            },
            type: {
              type: "string",
              enum: ["credit", "subscription", "access", "perk"],
              description:
                "credit=dollar reimbursement, subscription=included paid service, " +
                "access=lounge or venue access, perk=non-dollar benefit",
            },
            value: {
              type: "number",
              description: "Dollar amount or points amount. Use 1 for access/unlimited benefits.",
            },
            valueUnit: {
              type: "string",
              enum: ["dollars", "points"],
              description:
                "dollars=cash credits/reimbursements, points=loyalty/reward points or miles. " +
                "Use dollars for statement credits, dining credits, travel credits. " +
                "Use points for bonus points, miles, reward points.",
            },
            resetPeriod: {
              type: "string",
              enum: ["monthly", "quarterly", "semiannual", "annual", "once"],
              description:
                "How often the benefit resets; use 'semiannual' for twice-a-year benefits like H1/H2 splits or 'every 6 months'",
            },
            resetAnchor: {
              type: "string",
              enum: ["calendar", "statement", "anniversary"],
              description:
                "What the reset period is anchored to. Omit if unclear — will default to calendar.",
            },
            category: {
              type: "string",
              enum: ["dining", "travel", "streaming", "shopping", "lounge", "general", "wellness"],
              description:
                "Primary category for the benefit. Use 'wellness' for gym/fitness/spa/wellness benefits (e.g., Equinox, SoulCycle, fitness credits).",
            },
            classification: {
              type: "string",
              enum: [
                "discretionary-credit",
                "activation-perk",
                "auto-earn",
                "passive-perk",
                "one-time-bonus",
              ],
              description:
                "Behavioural bucket for the benefit. " +
                "discretionary-credit=a FIXED-DOLLAR recurring credit the user must ACTIVELY spend to capture (e.g. $25 monthly Uber credit, $300 annual travel credit, $120 dining credit). NOT for percentage-based earn rates, NOT for free trials, NOT for financing/pay-over-time features. " +
                "activation-perk=a benefit requiring a one-time or periodic enrollment/activation to use (e.g. quarterly bonus categories, complimentary status to enroll). " +
                "INCLUDES membership-reimbursement credits the cardholder enrolls in ONCE, after which the statement credit applies automatically each period: Walmart+ membership, Uber One membership, CLEAR Plus, Oura membership, and digital-entertainment / streaming-bundle credits. " +
                "(A free TRIAL of such a membership is one-time-bonus, not this. Uber CASH — a monthly balance the user must spend — is discretionary-credit, not this.) " +
                "auto-earn=value accrues automatically with no user action. INCLUDES cash-back percentages (1.5% cash back on all purchases, 3% on dining), points/miles multipliers (3x points on travel, 5x miles on hotels), and any 'earn X% on Y' or 'Nx points on Y' phrasing. " +
                "passive-perk=an always-on benefit needing no action and no tracking. INCLUDES no foreign transaction fees, purchase protection, rental insurance, pay-over-time / financing features (Chase Pay Over Time, Amazon pay over time), and auto-applied or recurring discounts (quarterly/monthly DashPass discount). " +
                "one-time-bonus=a single non-recurring reward. INCLUDES welcome/sign-up bonuses, anniversary points, AND free trials of subscriptions (DashPass 6-month trial, Apple TV+ trial, Walmart+ trial). " +
                "If unsure between discretionary-credit and auto-earn: a fixed dollar amount per period = discretionary-credit; a percentage or multiplier of spend = auto-earn. If unsure across other buckets, choose discretionary-credit.",
            },
            confidence: {
              type: "number",
              description:
                "Your confidence this benefit was extracted correctly, 0 to 1. " +
                "Use 0.85–0.95 when all fields are explicitly stated. " +
                "Use 0.70–0.84 when value is present but reset period is inferred. " +
                "Use below 0.70 when key details are ambiguous.",
            },
            note: {
              type: "string",
              description:
                "Short reviewer-facing note about anything ambiguous; omit if none.",
            },
          },
          // `confidence` is intentionally NOT required: when Haiku omits it (or
          // emits a non-number) the parser defaults the tier to 'low' (Task 59).
          required: ["name", "type", "value", "valueUnit", "resetPeriod", "category", "classification"],
        },
      },
    },
    required: ["benefits"],
  },
};
