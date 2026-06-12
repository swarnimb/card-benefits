/**
 * Task 89 — seeds a TEMPORARY demo SQLite DB from `src/lib/demo/demo-data.ts`.
 *
 * Invoked by `scripts/generate-demo-fixtures.ts` (never against dev.db). All
 * period rows are created by the REAL engine (`ensureCurrentPeriod`) and all
 * usedAmount writes go through `updateBenefitUsage` (CONSTRAINT-07) — this file
 * never hand-crafts a BenefitPeriod. setAndForget benefits get NO periods
 * (CONSTRAINT-17). Untracked benefits are persisted but get no periods either
 * (mirrors the live routes, which only ensure periods for tracked benefits).
 *
 * IMPORTANT: import this module only AFTER process.env.DATABASE_URL points at
 * the demo DB — `@/lib/db` reads DATABASE_URL at module load (CONSTRAINT-11).
 * The `prisma` argument must be the `@/lib/db` singleton: the engine functions
 * used here write through that same client.
 */
import type { PrismaClient } from "@prisma/client";
import { DEMO_CARDS, type DemoBenefit, type DemoCard } from "@/lib/demo/demo-data";
import { validateDemoCards } from "@/lib/demo/validate-demo-data";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import { updateBenefitUsage } from "@/lib/engine/usage";

/** Synthetic owner of every demo UserCard — queried back by the fixture builders. */
export const DEMO_USER_ID = "demo-user";

/** A benefit flagged `expiresSoon` must have an engine-produced period end within this many days. */
const EXPIRES_SOON_MAX_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Thrown when seeding fails. Names the offending demo record. */
export class DemoSeedError extends Error {
  record: string;

  constructor(record: string, problem: string) {
    super(`Demo seed failed at record [${record}]: ${problem}`);
    this.name = "DemoSeedError";
    this.record = record;
  }
}

/** Resolves the usage directive to a usedAmount. Validation guarantees the invariants used here. */
function resolveUsedAmount(benefit: DemoBenefit): number {
  if (benefit.usage.state === "unused") return 0;
  if (benefit.usage.state === "partial") return benefit.usage.usedAmount!;
  return benefit.usage.usedAmount ?? benefit.value!; // "maxed" — default to the full per-window cap
}

/**
 * Guards the `expiresSoon` directive: the boundary is engine-owned, so if the
 * engine-produced period does not end soon, that is a dataset/clock gap — fail
 * loudly instead of faking a boundary (benefit_periods is append-only).
 */
function assertExpiresSoon(label: string, periodEnd: Date | null): void {
  const limit = Date.now() + EXPIRES_SOON_MAX_DAYS * MS_PER_DAY;
  if (periodEnd === null || periodEnd.getTime() > limit) {
    throw new DemoSeedError(
      label,
      `expiresSoon directive not satisfied: engine-produced period ends ` +
        `${periodEnd?.toISOString() ?? "never"}, which is not within ${EXPIRES_SOON_MAX_DAYS} days of ` +
        `now (${new Date().toISOString()}). Adjust the generation clock or the dataset anchors — ` +
        `never hand-craft period rows.`,
    );
  }
}

/** Creates one Benefit row, then lets the engine create + fill its current period. */
async function seedBenefit(
  prisma: PrismaClient,
  userCardId: string,
  demo: DemoBenefit,
  label: string,
  createdAt: Date,
): Promise<void> {
  const benefit = await prisma.benefit.create({
    data: {
      userCardId,
      name: demo.name,
      description: demo.description,
      type: demo.type,
      value: demo.value,
      valueUnit: demo.valueUnit,
      resetPeriod: demo.resetPeriod,
      resetAnchor: demo.resetAnchor,
      category: demo.category,
      classification: demo.classification,
      tracked: demo.tracked,
      setAndForget: demo.setAndForget,
      activatedAt: demo.activatedAt,
      createdAt, // staggered so the benefits route's `orderBy createdAt asc` is deterministic
    },
  });

  // Periods exist only for tracked, non-set-and-forget benefits (CONSTRAINT-17;
  // mirrors the live overview/benefits routes).
  if (!demo.tracked || demo.setAndForget) return;

  const period = await ensureCurrentPeriod(benefit.id);
  if (period === null) {
    throw new DemoSeedError(label, "engine returned no period for a tracked, non-set-and-forget benefit");
  }

  const usedAmount = resolveUsedAmount(demo);
  if (usedAmount > 0) await updateBenefitUsage(benefit.id, usedAmount);

  if (demo.expiresSoon) assertExpiresSoon(label, period.periodEnd);
}

/** Creates the Card + UserCard pair for one demo card, then seeds its benefits. */
async function seedCard(prisma: PrismaClient, demo: DemoCard, benefitSeq: { n: number }): Promise<void> {
  const card = await prisma.card.create({
    data: {
      issuer: demo.issuer,
      name: demo.name,
      scrapeUrl: demo.scrapeUrl,
      defaultColor: demo.defaultColor,
      annualFee: demo.annualFee,
    },
  });
  const userCard = await prisma.userCard.create({
    data: {
      userId: DEMO_USER_ID,
      cardId: card.id,
      displayOrder: demo.displayOrder,
      statementDay: demo.statementDay,
      anniversaryDate: demo.anniversaryDate,
      lastVerifiedAt: new Date(),
    },
  });

  for (const benefit of demo.benefits) {
    const createdAt = new Date(Date.now() + benefitSeq.n++ * 1000);
    await seedBenefit(prisma, userCard.id, benefit, `${demo.issuer} ${demo.name} — ${benefit.name}`, createdAt);
  }
}

/**
 * Seeds the demo DB from DEMO_CARDS. Validates the full dataset up front so an
 * invalid entry throws (naming the record) before any row is written.
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  validateDemoCards(DEMO_CARDS);

  // Defensive wipe — the orchestrator always hands us a fresh DB, but a rerun
  // against a stale file must still produce a deterministic result.
  await prisma.benefitPeriod.deleteMany({});
  await prisma.benefit.deleteMany({});
  await prisma.userCard.deleteMany({});
  await prisma.card.deleteMany({});

  const benefitSeq = { n: 0 };
  for (const card of DEMO_CARDS) {
    await seedCard(prisma, card, benefitSeq);
  }
}
