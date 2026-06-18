/**
 * Single source of truth for the runtime validation allowlists used by the
 * benefit API routes (POST /api/benefits, PATCH/DELETE /api/benefits/[id],
 * POST /api/benefits/confirm). Each `Set` mirrors exactly one of the string
 * union types in `@/types/benefit`: the element list is typed by that union so
 * the values cannot drift from the type (an off-enum member is a compile
 * error), while the exported `Set` is widened to `ReadonlySet<string>` so route
 * handlers can call `.has()` with an unvalidated `string` from a request body.
 * Routes import only the Sets they need.
 */
import type {
  BenefitType,
  ResetPeriod,
  ResetAnchor,
  ValueUnit,
  BenefitCategory,
} from "@/types/benefit";

/** Accepted values for a benefit's `type` field — mirrors {@link BenefitType}. */
export const VALID_TYPES: ReadonlySet<string> = new Set<BenefitType>([
  "credit",
  "subscription",
  "access",
  "perk",
]);

/** Accepted values for a benefit's `resetPeriod` field — mirrors {@link ResetPeriod}. */
export const VALID_RESET_PERIODS: ReadonlySet<string> = new Set<ResetPeriod>([
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "once",
]);

/** Accepted values for a benefit's `resetAnchor` field — mirrors {@link ResetAnchor}. */
export const VALID_RESET_ANCHORS: ReadonlySet<string> = new Set<ResetAnchor>([
  "calendar",
  "statement",
  "anniversary",
]);

/** Accepted values for a benefit's `valueUnit` field — mirrors {@link ValueUnit}. */
export const VALID_VALUE_UNITS: ReadonlySet<string> = new Set<ValueUnit>([
  "dollars",
  "points",
]);

/** Accepted values for a benefit's `category` field — mirrors {@link BenefitCategory}. */
export const VALID_CATEGORIES: ReadonlySet<string> = new Set<BenefitCategory>([
  "dining",
  "travel",
  "streaming",
  "shopping",
  "lounge",
  "general",
  "wellness",
]);
