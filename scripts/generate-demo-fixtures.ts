/**
 * Task 89 — demo fixture generator. Run from the project root:
 *
 *   npm run demo:fixtures        (= npx tsx scripts/generate-demo-fixtures.ts)
 *
 * Pipeline:
 *   1. Create a TEMP SQLite DB at prisma/demo.db (gitignored, deleted after).
 *   2. Apply the real migrations (`npx prisma migrate deploy`).
 *   3. Seed it from src/lib/demo/demo-data.ts (prisma/seed-demo.ts) — the real
 *      engine creates every period; the clock is pinned to DEMO_NOW so the
 *      engine-produced boundaries deterministically populate all three Overview
 *      triage buckets (see scripts/lib/pinned-date.ts).
 *   4. Build the five fixture payloads via the same lib functions the API
 *      routes call (scripts/lib/build-demo-fixtures.ts).
 *   5. Publish atomically: write to fixtures.tmp, then swap into
 *      src/lib/demo/fixtures/ — a failed run never leaves a partial set.
 *
 * env note: process.env.DATABASE_URL is set below BEFORE any db-touching module
 * loads — everything that imports `@/lib/db` is imported dynamically after it.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withPinnedDate } from "./lib/pinned-date";
import type { DemoFixtures } from "./lib/build-demo-fixtures";

const PROJECT_ROOT = process.cwd();
const DEMO_DB_PATH = join(PROJECT_ROOT, "prisma", "demo.db");
const FIXTURES_DIR = join(PROJECT_ROOT, "src", "lib", "demo", "fixtures");
const FIXTURES_TMP_DIR = `${FIXTURES_DIR}.tmp`;

/**
 * Pinned generation clock: 2026-06-27 12:00 local. Late June makes the engine's
 * real calendar boundaries (monthly + quarterly + semiannual all ending Jun 30)
 * land within the 7-day "expiring soon" window, so the needsAttention bucket is
 * non-empty — while annual/anniversary/statement benefits stay onTrack/done.
 * Fixtures are a static snapshot, so a fixed instant keeps them reproducible.
 */
const DEMO_NOW_MS = new Date(2026, 5, 27, 12, 0, 0).getTime();

/** Thrown when any generation step fails — names the step and preserves the cause. */
class FixtureGenerationError extends Error {
  step: string;

  constructor(step: string, problem: string, cause?: unknown) {
    super(`generate-demo-fixtures failed at step "${step}": ${problem}`, { cause });
    this.name = "FixtureGenerationError";
    this.step = step;
  }
}

function assertProjectRoot(): void {
  if (!existsSync(join(PROJECT_ROOT, "prisma", "schema.prisma"))) {
    throw new FixtureGenerationError("preflight", `must run from the project root (cwd: ${PROJECT_ROOT})`);
  }
}

/** Deletes the temp demo DB (and its sqlite journal) if present. */
function removeDemoDb(): void {
  for (const file of [DEMO_DB_PATH, `${DEMO_DB_PATH}-journal`]) {
    rmSync(file, { force: true });
  }
}

/** Applies the real migrations to the fresh demo DB. */
function applySchema(): void {
  try {
    execSync("npx prisma migrate deploy", { cwd: PROJECT_ROOT, env: process.env, stdio: "pipe" });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new FixtureGenerationError("migrate", `prisma migrate deploy failed against ${DEMO_DB_PATH}\n${stderr}`, err);
  }
}

/** Seeds the demo DB and builds all fixture payloads (clock pinned by the caller). */
async function seedAndBuild(): Promise<DemoFixtures> {
  // Dynamic imports: these modules (transitively) read DATABASE_URL at load.
  const { prisma } = await import("../src/lib/db");
  try {
    const { seedDemo, DEMO_USER_ID } = await import("../prisma/seed-demo");
    const { buildAllFixtures } = await import("./lib/build-demo-fixtures");
    await seedDemo(prisma);
    return await buildAllFixtures(prisma, DEMO_USER_ID, PROJECT_ROOT);
  } finally {
    await prisma.$disconnect();
  }
}

/** Writes all fixtures to a temp dir, then swaps it in — never a partial set. */
function publishFixtures(fixtures: DemoFixtures): void {
  rmSync(FIXTURES_TMP_DIR, { recursive: true, force: true });
  mkdirSync(FIXTURES_TMP_DIR, { recursive: true });
  for (const [name, payload] of Object.entries(fixtures)) {
    writeFileSync(join(FIXTURES_TMP_DIR, `${name}.json`), JSON.stringify(payload, null, 2) + "\n", "utf-8");
  }
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
  renameSync(FIXTURES_TMP_DIR, FIXTURES_DIR);
}

function printSummary(fixtures: DemoFixtures): void {
  const { overview } = fixtures;
  const benefitTotal = Object.values(fixtures["benefits-by-card"]).reduce((s, list) => s + list.length, 0);
  console.log(`✔ fixtures written to ${FIXTURES_DIR}`);
  console.log(`  user-cards: ${fixtures["user-cards"].length} cards, ${benefitTotal} benefits`);
  console.log(
    `  overview triage: needsAttention=${overview.needsAttention.length} ` +
      `onTrack=${overview.onTrack.length} done=${overview.done.length}`,
  );
  console.log(
    `  moneyAtRisk: $${overview.moneyAtRisk.totalUnredeemed} ` +
      `(soonest reset in ${overview.moneyAtRisk.soonestDaysUntilReset} days)`,
  );
  console.log(`  portfolio-stats: ${JSON.stringify(fixtures["portfolio-stats"])}`);
  console.log(`  catalog: ${fixtures.catalog.length} entries`);
}

async function main(): Promise<void> {
  assertProjectRoot();

  // Must precede every db-touching import (src/lib/db reads it at module load).
  process.env.DATABASE_URL = `file:${DEMO_DB_PATH.replace(/\\/g, "/")}`;

  try {
    removeDemoDb();
    applySchema();
    const fixtures = await withPinnedDate(DEMO_NOW_MS, seedAndBuild);
    publishFixtures(fixtures);
    printSummary(fixtures);
  } finally {
    removeDemoDb(); // temp DB never outlives the run — success or failure
    rmSync(FIXTURES_TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error("generate-demo-fixtures FAILED:", err);
  process.exitCode = 1;
});
