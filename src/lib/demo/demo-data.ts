/**
 * Task 88 — realistic (100% FICTIONAL) demo dataset.
 *
 * Pure data: typed plain objects only. No DB access, no imports beyond shared
 * benefit types. Consumed by the Task 89 seeder, which creates Card / UserCard /
 * Benefit / BenefitPeriod rows from these objects.
 *
 * COVERAGE CHECKLIST — keep ALL of these intact when editing:
 *  1. 5 cards across 4 real issuers (Amex ×2, Chase, Capital One, Citi) with
 *     plausible 2026-ish benefit structures and annual fees.
 *  2. Overview triage fully populated: several needs-attention (expiresSoon +
 *     low usage: Uber Cash, DoorDash, Resy), several on-track (partial: airline
 *     fee, FHR hotel, StubHub, Venture X portal, Citi quarterly), several done
 *     (maxed: CSR travel, Gold dining, Dunkin'). Nonzero money-at-risk.
 *  3. Reset variety: monthly, quarterly, semiannual, annual, once — PLUS one
 *     uneven per-window benefit (Uber Cash: $15/mo constant per CONSTRAINT-26,
 *     December's extra $20 only described, so the "→ $180/yr" roll-up shows).
 *  4. Anchor variety: calendar (most), statement (Dunkin' credit), anniversary
 *     (CSR travel credit, Venture X portal + anniversary miles). Every card has
 *     statementDay + anniversaryDate.
 *  5. All 5 classification buckets: discretionary-credit + activation-perk
 *     (tracked: true); auto-earn + passive-perk + one-time-bonus (tracked:
 *     false — Cards hidden split).
 *  6. Set-and-forget: Digital Entertainment Credit (activatedAt set) and CLEAR
 *     Plus Credit (activatedAt: null). setAndForget benefits get NO periods
 *     (CONSTRAINT-17) — the seeder must skip period creation for them.
 *  7. Usage spread on first load: unused, partial, and maxed sliders all
 *     present.
 *  8. Everything fictional — plausibility over authenticity. No real personal
 *     usage amounts or dates.
 *
 * CONSTRAINT-24: every `value` below is the PER-WINDOW amount, never the
 * annualized total (e.g. the semiannual FHR hotel credit stores 100, not 200).
 */

import type {
  BenefitCategory,
  BenefitClassification,
  BenefitType,
  ResetAnchor,
  ResetPeriod,
  ValueUnit,
} from "@/types/benefit";

/** How far into the current window the seeder should set the open period. */
export type DemoUsageState = "unused" | "partial" | "maxed";

/**
 * Usage directive for the seeder.
 * - "unused" → usedAmount 0
 * - "partial" → usedAmount REQUIRED (must be 0 < usedAmount < value)
 * - "maxed" → usedAmount defaults to the benefit's full `value`; usedAmount may
 *   override but is normally omitted
 * Ignored for setAndForget and untracked benefits (no slider / no period).
 */
export interface DemoUsage {
  state: DemoUsageState;
  usedAmount?: number;
}

/**
 * One benefit row — all Benefit fields the schema needs minus ids/timestamps,
 * plus seeding directives (`usage`, `expiresSoon`).
 */
export interface DemoBenefit {
  name: string;
  description: string | null;
  type: BenefitType;
  /** PER-WINDOW cap (CONSTRAINT-24); null = unlimited / not applicable. */
  value: number | null;
  valueUnit: ValueUnit;
  resetPeriod: ResetPeriod;
  resetAnchor: ResetAnchor;
  category: BenefitCategory;
  classification: BenefitClassification;
  tracked: boolean;
  setAndForget: boolean;
  /** Only meaningful when setAndForget; null = not yet activated. */
  activatedAt: Date | null;
  /** Seeding directive — initial usedAmount for the open period. */
  usage: DemoUsage;
  /**
   * Seeding hint: arrange the open period so it ends within ~5 days of seed
   * time (the seeder writes periodEnd directly), so the benefit lands in the
   * Overview needs-attention bucket.
   */
  expiresSoon?: true;
}

/** Catalog card + user-card fields, with nested benefits. */
export interface DemoCard {
  issuer: string;
  name: string;
  defaultColor: string;
  scrapeUrl: string | null;
  annualFee: number | null;
  displayOrder: number;
  /** 1–31 — required by any benefit on this card using the statement anchor. */
  statementDay: number | null;
  /** Required by any benefit on this card using the anniversary anchor. */
  anniversaryDate: Date | null;
  benefits: DemoBenefit[];
}

export const DEMO_CARDS: DemoCard[] = [
  // ── 1. Amex Platinum — $695 AF ─────────────────────────────────────────────
  {
    issuer: "Amex",
    name: "Platinum Card",
    defaultColor: "#C9A961",
    scrapeUrl: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
    annualFee: 695,
    displayOrder: 0,
    statementDay: 17,
    anniversaryDate: new Date(2024, 7, 22), // Aug 22, 2024 (fictional open date)
    benefits: [
      {
        // CONSTRAINT-26 demo: uneven schedule stored as constant $15/window.
        // The "→ $180/yr" roll-up under-counts the real $200 — by design.
        name: "Uber Cash",
        description:
          "$15 in Uber Cash each month for rides or Uber Eats ($35 in December).",
        type: "credit",
        value: 15,
        valueUnit: "dollars",
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "partial", usedAmount: 4.5 }, // low usage + expiring = needs attention
        expiresSoon: true,
      },
      {
        name: "Airline Fee Credit",
        description:
          "Up to $200 per calendar year in incidental fees with one selected airline.",
        type: "credit",
        value: 200,
        valueUnit: "dollars",
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "partial", usedAmount: 120 },
      },
      {
        name: "Fine Hotels + Resorts Credit",
        description:
          "Up to $100 back each half of the year on prepaid FHR or The Hotel Collection bookings.",
        type: "credit",
        value: 100, // per 6-month window (CONSTRAINT-24), not $200/yr
        valueUnit: "dollars",
        resetPeriod: "semiannual",
        resetAnchor: "calendar",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "partial", usedAmount: 60 },
      },
      {
        name: "Equinox Credit",
        description: "Up to $25 back each month on Equinox club memberships.",
        type: "credit",
        value: 25,
        valueUnit: "dollars",
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "wellness",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
      {
        // Set-and-forget #1 — ACTIVATED. No BenefitPeriod rows (CONSTRAINT-17).
        name: "Digital Entertainment Credit",
        description:
          "Up to $20 back monthly on the streaming bundle (Disney+, Hulu, ESPN+, Peacock, NYT).",
        type: "credit",
        value: 20,
        valueUnit: "dollars",
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "streaming",
        classification: "activation-perk",
        tracked: true,
        setAndForget: true,
        activatedAt: new Date(2026, 1, 8), // Feb 8, 2026 — enrolled, runs itself
        usage: { state: "unused" }, // ignored by seeder: setAndForget gets no period
      },
      {
        // Set-and-forget #2 — NOT YET ACTIVATED.
        name: "CLEAR Plus Credit",
        description:
          "Up to $189 back per calendar year on a CLEAR Plus membership.",
        type: "credit",
        value: 189,
        valueUnit: "dollars",
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "travel",
        classification: "activation-perk",
        tracked: true,
        setAndForget: true,
        activatedAt: null, // not set up yet
        usage: { state: "unused" }, // ignored by seeder: setAndForget gets no period
      },
      {
        name: "5x Points on Flights",
        description:
          "Earn 5x Membership Rewards points on flights booked directly with airlines.",
        type: "perk",
        value: null,
        valueUnit: "points",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "travel",
        classification: "auto-earn",
        tracked: false, // hidden split
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
      {
        name: "Global Lounge Collection",
        description:
          "Access to Centurion Lounges, Priority Pass Select, Delta Sky Clubs and more.",
        type: "access",
        value: null,
        valueUnit: "dollars",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "lounge",
        classification: "passive-perk",
        tracked: false, // hidden split
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
    ],
  },

  // ── 2. Chase Sapphire Reserve — $550 AF ───────────────────────────────────
  {
    issuer: "Chase",
    name: "Sapphire Reserve",
    defaultColor: "#3B5BDB",
    scrapeUrl:
      "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
    annualFee: 550,
    displayOrder: 1,
    statementDay: 5,
    anniversaryDate: new Date(2023, 10, 3), // Nov 3 — drives anniversary anchor
    benefits: [
      {
        name: "Annual Travel Credit",
        description:
          "$300 automatically applied to travel purchases each cardmember year.",
        type: "credit",
        value: 300,
        valueUnit: "dollars",
        resetPeriod: "annual",
        resetAnchor: "anniversary",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "maxed" }, // done — fully captured this cardmember year
      },
      {
        name: "DoorDash Restaurant Credit",
        description: "$5 monthly DoorDash promo credit for restaurant orders.",
        type: "credit",
        value: 5,
        valueUnit: "dollars",
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" }, // unused + expiring = needs attention
        expiresSoon: true,
      },
      {
        name: "StubHub Credit",
        description:
          "Up to $150 each half of the year on StubHub and viagogo event tickets.",
        type: "credit",
        value: 150, // per 6-month window (CONSTRAINT-24)
        valueUnit: "dollars",
        resetPeriod: "semiannual",
        resetAnchor: "calendar",
        category: "general",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "partial", usedAmount: 85 },
      },
      {
        name: "Priority Pass Select",
        description:
          "Complimentary Priority Pass Select membership — 1,300+ airport lounges.",
        type: "access",
        value: null,
        valueUnit: "dollars",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "lounge",
        classification: "passive-perk",
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
      {
        name: "60,000-Point Welcome Bonus",
        description:
          "60,000 bonus points after spending $4,000 in the first 3 months.",
        type: "perk",
        value: 60000,
        valueUnit: "points",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "general",
        classification: "one-time-bonus",
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
    ],
  },

  // ── 3. Capital One Venture X — $395 AF ────────────────────────────────────
  {
    issuer: "Capital One",
    name: "Venture X",
    defaultColor: "#B73A3A",
    scrapeUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    annualFee: 395,
    displayOrder: 2,
    statementDay: 21,
    anniversaryDate: new Date(2025, 2, 19), // Mar 19 — drives anniversary anchor
    benefits: [
      {
        name: "Travel Portal Credit",
        description:
          "$300 annual credit for bookings through Capital One Travel.",
        type: "credit",
        value: 300,
        valueUnit: "dollars",
        resetPeriod: "annual",
        resetAnchor: "anniversary",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "partial", usedAmount: 150 }, // on track
      },
      {
        name: "10,000 Anniversary Miles",
        description:
          "10,000 bonus miles automatically awarded every account anniversary.",
        type: "perk",
        value: 10000,
        valueUnit: "points",
        resetPeriod: "annual",
        resetAnchor: "anniversary",
        category: "general",
        classification: "auto-earn", // posts automatically — no user action
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
      {
        name: "Capital One Lounge Access",
        description:
          "Unlimited access to Capital One Lounges and Priority Pass for the cardholder.",
        type: "access",
        value: null,
        valueUnit: "dollars",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "lounge",
        classification: "passive-perk",
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
      {
        name: "75,000-Mile Welcome Bonus",
        description:
          "75,000 bonus miles after spending $4,000 in the first 3 months.",
        type: "perk",
        value: 75000,
        valueUnit: "points",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "general",
        classification: "one-time-bonus",
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
    ],
  },

  // ── 4. Amex Gold — $325 AF ────────────────────────────────────────────────
  {
    issuer: "Amex",
    name: "Gold Card",
    defaultColor: "#C9A961",
    scrapeUrl:
      "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
    annualFee: 325,
    displayOrder: 3,
    statementDay: 11, // drives the statement-anchored Dunkin' credit
    anniversaryDate: new Date(2024, 4, 6), // May 6 (fictional open date)
    benefits: [
      {
        name: "Dining Credit",
        description:
          "Up to $10 back monthly at Grubhub, The Cheesecake Factory, Goldbelly and select partners.",
        type: "credit",
        value: 10,
        valueUnit: "dollars",
        resetPeriod: "monthly",
        resetAnchor: "calendar",
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "maxed" }, // done this month
      },
      {
        name: "Resy Credit",
        description:
          "Up to $50 back each half of the year on Resy restaurant purchases.",
        type: "credit",
        value: 50, // per 6-month window (CONSTRAINT-24), not $100/yr
        valueUnit: "dollars",
        resetPeriod: "semiannual",
        resetAnchor: "calendar",
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" }, // whole $50 at risk = needs attention
        expiresSoon: true,
      },
      {
        name: "Dunkin' Credit",
        description: "Up to $7 back each statement period at Dunkin' locations.",
        type: "credit",
        value: 7,
        valueUnit: "dollars",
        resetPeriod: "monthly",
        resetAnchor: "statement", // statement-day anchor variety
        category: "dining",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "maxed" },
      },
      {
        name: "4x Points at Restaurants",
        description:
          "Earn 4x Membership Rewards points at restaurants worldwide.",
        type: "perk",
        value: null,
        valueUnit: "points",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "dining",
        classification: "auto-earn",
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
    ],
  },

  // ── 5. Citi Strata Premier — $95 AF ───────────────────────────────────────
  {
    issuer: "Citi",
    name: "Strata Premier",
    defaultColor: "#2E5BC9",
    scrapeUrl: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
    annualFee: 95,
    displayOrder: 4,
    statementDay: 27,
    anniversaryDate: new Date(2025, 8, 14), // Sep 14 (fictional open date)
    benefits: [
      {
        name: "Annual Hotel Credit",
        description:
          "$100 off a single hotel stay of $500+ booked through CitiTravel.com, once per calendar year.",
        type: "credit",
        value: 100,
        valueUnit: "dollars",
        resetPeriod: "annual",
        resetAnchor: "calendar",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" }, // unused, but months of runway — not urgent
      },
      {
        name: "Citi Travel Credit",
        description:
          "Up to $25 back each quarter on bookings made through CitiTravel.com.",
        type: "credit",
        value: 25, // per quarter (CONSTRAINT-24) — quarterly reset variety
        valueUnit: "dollars",
        resetPeriod: "quarterly",
        resetAnchor: "calendar",
        category: "travel",
        classification: "discretionary-credit",
        tracked: true,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "partial", usedAmount: 10 },
      },
      {
        name: "No Foreign Transaction Fees",
        description: "No foreign transaction fees on purchases abroad.",
        type: "perk",
        value: null,
        valueUnit: "dollars",
        resetPeriod: "once",
        resetAnchor: "calendar",
        category: "general",
        classification: "passive-perk",
        tracked: false,
        setAndForget: false,
        activatedAt: null,
        usage: { state: "unused" },
      },
    ],
  },
];
