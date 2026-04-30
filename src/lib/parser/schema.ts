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
              enum: ["monthly", "quarterly", "annual", "once"],
              description: "How often the benefit resets",
            },
            resetAnchor: {
              type: "string",
              enum: ["calendar", "statement", "anniversary"],
              description:
                "What the reset period is anchored to. Omit if unclear — will default to calendar.",
            },
            category: {
              type: "string",
              enum: ["dining", "travel", "streaming", "shopping", "lounge", "general"],
              description: "Primary category for the benefit",
            },
            isTrackable: {
              type: "boolean",
              description: "True if the benefit has a dollar amount or usage count that can be tracked",
            },
            confidence: {
              type: "number",
              description:
                "Confidence 0.0–1.0. Use 0.85–0.95 when all fields are explicitly stated. " +
                "Use 0.70–0.84 when value is present but reset period is inferred. " +
                "Use below 0.70 when key details are ambiguous.",
            },
          },
          required: ["name", "type", "value", "valueUnit", "resetPeriod", "category", "isTrackable", "confidence"],
        },
      },
    },
    required: ["benefits"],
  },
};
