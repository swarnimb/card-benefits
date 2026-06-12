/**
 * Task 89 — builds the demo fixture payloads by calling the SAME library
 * functions the live API routes call (`ensureCurrentPeriod`, `toBenefitWithPeriod`,
 * `buildOverviewTriage`, `computePortfolioStats`). No business logic is
 * reimplemented here — only each route's serialization glue is mirrored, 1:1,
 * so the fixtures match the live response shapes exactly:
 *
 *   overview.json         ← GET /api/overview          (OverviewData)
 *   user-cards.json       ← GET /api/user-cards        (array)
 *   benefits-by-card.json ← GET /api/user-cards/[id]/benefits, keyed by userCard id
 *   portfolio-stats.json  ← GET /api/portfolio/stats   (PortfolioStats)
 *   catalog.json          ← GET /api/catalog           (CatalogCard[])
 *
 * Import only AFTER DATABASE_URL points at the demo DB (`@/lib/db` reads it at
 * module load) — the orchestrator imports this module dynamically.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import { toBenefitWithPeriod } from "@/lib/engine/mappers";
import { buildOverviewTriage } from "@/lib/engine/expiring";
import { computePortfolioStats, type PortfolioCardInput } from "@/lib/engine/portfolio";
import type { BenefitWithPeriod } from "@/types/benefit";
import type { UserCardWithBenefits, Issuer, CatalogCard } from "@/types/card";
import type { OverviewData } from "@/types/api";

/** Thrown when a fixture payload cannot be built or fails its sanity checks. */
export class FixtureBuildError extends Error {
  fixture: string;

  constructor(fixture: string, problem: string, cause?: unknown) {
    super(`Fixture "${fixture}" build failed: ${problem}`, { cause });
    this.name = "FixtureBuildError";
    this.fixture = fixture;
  }
}

/** The five fixture payloads, keyed by output file basename (without .json). */
export interface DemoFixtures {
  overview: OverviewData;
  "user-cards": unknown[];
  "benefits-by-card": Record<string, BenefitWithPeriod[]>;
  "portfolio-stats": unknown;
  catalog: CatalogCard[];
}

// Mirrors src/app/api/user-cards/[id]/benefits/route.ts
const TYPE_ORDER = ["credit", "subscription", "access", "perk"];

/** Mirrors the GET /api/overview handler body (route.ts lines 19-52). */
async function loadCardsWithBenefits(prisma: PrismaClient, userId: string): Promise<UserCardWithBenefits[]> {
  const userCards = await prisma.userCard.findMany({
    where: { userId },
    include: { card: true, benefits: true },
    orderBy: { displayOrder: "asc" },
  });

  const cards: UserCardWithBenefits[] = [];
  for (const userCard of userCards) {
    const benefitsWithPeriods: BenefitWithPeriod[] = [];
    for (const benefit of userCard.benefits) {
      const period = benefit.tracked && !benefit.setAndForget ? await ensureCurrentPeriod(benefit.id) : null;
      benefitsWithPeriods.push(toBenefitWithPeriod(benefit, period));
    }
    cards.push({
      id: userCard.id,
      userId: userCard.userId,
      cardId: userCard.cardId,
      displayOrder: userCard.displayOrder,
      lastVerifiedAt: userCard.lastVerifiedAt,
      statementDay: userCard.statementDay,
      anniversaryDate: userCard.anniversaryDate,
      createdAt: userCard.createdAt,
      card: {
        id: userCard.card.id,
        issuer: userCard.card.issuer as Issuer,
        name: userCard.card.name,
        scrapeUrl: userCard.card.scrapeUrl,
        defaultColor: userCard.card.defaultColor,
      },
      benefits: benefitsWithPeriods,
    });
  }
  return cards;
}

/** Mirrors the GET /api/user-cards handler response mapping. */
async function buildUserCards(prisma: PrismaClient, userId: string): Promise<unknown[]> {
  const userCards = await prisma.userCard.findMany({
    where: { userId },
    orderBy: { displayOrder: "asc" },
    include: { card: true, _count: { select: { benefits: true } } },
  });

  return userCards.map((uc) => ({
    id: uc.id,
    cardId: uc.cardId,
    displayOrder: uc.displayOrder,
    lastVerifiedAt: uc.lastVerifiedAt?.toISOString() ?? null,
    statementDay: uc.statementDay,
    anniversaryDate: uc.anniversaryDate?.toISOString() ?? null,
    benefitCount: uc._count.benefits,
    card: {
      id: uc.card.id,
      issuer: uc.card.issuer,
      name: uc.card.name,
      defaultColor: uc.card.defaultColor,
      scrapeUrl: uc.card.scrapeUrl,
      annualFee: uc.card.annualFee,
    },
  }));
}

/** Mirrors GET /api/user-cards/[id]/benefits for one card. */
async function buildBenefitsForCard(prisma: PrismaClient, userCardId: string): Promise<BenefitWithPeriod[]> {
  const benefits = await prisma.benefit.findMany({ where: { userCardId }, orderBy: { createdAt: "asc" } });
  const result: BenefitWithPeriod[] = [];
  for (const benefit of benefits) {
    const period = benefit.tracked && !benefit.setAndForget ? await ensureCurrentPeriod(benefit.id) : null;
    result.push(toBenefitWithPeriod(benefit, period));
  }
  result.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  return result;
}

/** Mirrors the GET /api/portfolio/stats handler input mapping. */
async function buildPortfolioStats(prisma: PrismaClient, userId: string): Promise<unknown> {
  const userCards = await prisma.userCard.findMany({
    where: { userId },
    include: { card: true, benefits: { include: { periods: true } } },
  });

  const cards: PortfolioCardInput[] = userCards.map((uc) => ({
    annualFee: uc.card.annualFee,
    benefits: uc.benefits.map((b) => ({
      tracked: b.tracked,
      resetPeriod: b.resetPeriod,
      setAndForget: b.setAndForget,
      value: b.value,
      periods: b.periods,
    })),
  }));

  return computePortfolioStats(cards);
}

/** Mirrors GET /api/catalog — the static catalog file, parsed (parse failures throw loudly). */
function buildCatalog(projectRoot: string): CatalogCard[] {
  const catalogPath = join(projectRoot, "data", "card-catalog.json");
  try {
    return JSON.parse(readFileSync(catalogPath, "utf-8")) as CatalogCard[];
  } catch (err) {
    throw new FixtureBuildError("catalog", `cannot read/parse ${catalogPath}`, err);
  }
}

/** The dataset is designed to populate every triage bucket — an empty bucket means a broken demo. */
function assertTriageBucketsPopulated(overview: OverviewData): void {
  for (const bucket of ["needsAttention", "onTrack", "done"] as const) {
    if (overview[bucket].length === 0) {
      throw new FixtureBuildError(
        "overview",
        `triage bucket "${bucket}" is empty — the demo dataset/pinned clock must populate all three buckets`,
      );
    }
  }
}

/** Builds all five fixture payloads against the seeded demo DB. */
export async function buildAllFixtures(
  prisma: PrismaClient,
  userId: string,
  projectRoot: string,
): Promise<DemoFixtures> {
  const cards = await loadCardsWithBenefits(prisma, userId);
  if (cards.length === 0) {
    throw new FixtureBuildError("overview", `no user cards found for demo user "${userId}" — seed produced nothing`);
  }

  const overview = buildOverviewTriage(cards);
  assertTriageBucketsPopulated(overview);

  const benefitsByCard: Record<string, BenefitWithPeriod[]> = {};
  for (const card of cards) {
    benefitsByCard[card.id] = await buildBenefitsForCard(prisma, card.id);
  }

  return {
    overview,
    "user-cards": await buildUserCards(prisma, userId),
    "benefits-by-card": benefitsByCard,
    "portfolio-stats": await buildPortfolioStats(prisma, userId),
    catalog: buildCatalog(projectRoot),
  };
}
