/**
 * Task 89 — pure validation for the demo dataset (`demo-data.ts`).
 *
 * Runs BEFORE any DB write so an invalid dataset entry fails loudly with the
 * offending record named, and the seeder never produces a partially-seeded DB.
 * No DB imports — unit-testable in isolation.
 */
import type { DemoBenefit, DemoCard } from "@/lib/demo/demo-data";

/** Thrown for an invalid demo dataset entry. Names the offending record. */
export class DemoDataError extends Error {
  /** Human-readable record label, e.g. `Amex Platinum Card — Uber Cash`. */
  record: string;

  constructor(record: string, problem: string) {
    super(`Invalid demo dataset record [${record}]: ${problem}`);
    this.name = "DemoDataError";
    this.record = record;
  }
}

/** Usage directives only apply to tracked, non-set-and-forget benefits (they get a period + slider). */
function validateUsage(label: string, benefit: DemoBenefit): void {
  if (benefit.setAndForget || !benefit.tracked) return; // directive ignored by the seeder

  const { state, usedAmount } = benefit.usage;

  if (state === "partial") {
    if (usedAmount === undefined) {
      throw new DemoDataError(label, `usage.state "partial" requires usage.usedAmount`);
    }
    if (benefit.value === null) {
      throw new DemoDataError(label, `usage.state "partial" requires a non-null value (cap)`);
    }
    if (!(usedAmount > 0 && usedAmount < benefit.value)) {
      throw new DemoDataError(
        label,
        `usage.usedAmount must satisfy 0 < usedAmount < value (got ${usedAmount}, value ${benefit.value})`,
      );
    }
  }

  if (state === "maxed") {
    if (benefit.value === null) {
      throw new DemoDataError(label, `usage.state "maxed" requires a non-null value (cap)`);
    }
    if (usedAmount !== undefined && (usedAmount <= 0 || usedAmount > benefit.value)) {
      throw new DemoDataError(
        label,
        `usage.usedAmount override must satisfy 0 < usedAmount <= value (got ${usedAmount}, value ${benefit.value})`,
      );
    }
  }

  if (state === "unused" && usedAmount !== undefined) {
    throw new DemoDataError(label, `usage.state "unused" must not carry usage.usedAmount`);
  }
}

/** The period engine throws on missing anchor data — catch it at the dataset level with a named record. */
function validateAnchors(label: string, card: DemoCard, benefit: DemoBenefit): void {
  if (benefit.resetPeriod === "once") return; // engine ignores anchors for "once"

  if (benefit.resetAnchor === "statement") {
    if (card.statementDay === null || card.statementDay < 1 || card.statementDay > 31) {
      throw new DemoDataError(
        label,
        `resetAnchor "statement" requires card.statementDay in 1-31 (got ${card.statementDay})`,
      );
    }
  }

  if (benefit.resetAnchor === "anniversary" && card.anniversaryDate === null) {
    throw new DemoDataError(label, `resetAnchor "anniversary" requires card.anniversaryDate`);
  }
}

/** expiresSoon only makes sense for benefits that surface in the Overview triage with a period end. */
function validateExpiresSoon(label: string, benefit: DemoBenefit): void {
  if (!benefit.expiresSoon) return;
  if (!benefit.tracked) {
    throw new DemoDataError(label, `expiresSoon is meaningless on an untracked benefit`);
  }
  if (benefit.setAndForget) {
    throw new DemoDataError(label, `expiresSoon is invalid on a setAndForget benefit (no periods, CONSTRAINT-17)`);
  }
  if (benefit.resetPeriod === "once") {
    throw new DemoDataError(label, `expiresSoon is invalid on a "once" benefit (no period end)`);
  }
}

/**
 * Validates the full demo dataset. Throws DemoDataError (naming the offending
 * card/benefit) on the first invalid entry; returns silently when valid.
 */
export function validateDemoCards(cards: DemoCard[]): void {
  if (cards.length === 0) throw new DemoDataError("DEMO_CARDS", "dataset is empty");

  for (const card of cards) {
    const cardLabel = `${card.issuer} ${card.name}`;
    if (!card.issuer.trim() || !card.name.trim()) {
      throw new DemoDataError(cardLabel, "issuer and name must be non-empty");
    }
    if (card.benefits.length === 0) {
      throw new DemoDataError(cardLabel, "card has no benefits");
    }

    for (const benefit of card.benefits) {
      if (!benefit.name.trim()) {
        throw new DemoDataError(cardLabel, "benefit name must be non-empty");
      }
      const label = `${cardLabel} — ${benefit.name}`;
      validateUsage(label, benefit);
      validateAnchors(label, card, benefit);
      validateExpiresSoon(label, benefit);
    }
  }
}
