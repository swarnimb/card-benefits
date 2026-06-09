/**
 * Audit: find benefits whose stored `value` may be an ANNUAL total when it
 * should be the PER-WINDOW amount (Feature 10.1).
 *
 * Sub-annual benefits (monthly/quarterly/semiannual) should store the
 * per-window dollar/point cap — not the year's total. A scrape that read
 * "$600 per year ($50/month)" may have persisted 600 against a monthly reset.
 * This script FLAGS suspects for human review; it never re-scrapes and never
 * auto-corrects. The user supplies confirmed corrections via --apply.
 *
 * Writes ONLY `Benefit.value` (apply mode). Never touches `usedAmount` and
 * never mutates a BenefitPeriod (CONSTRAINT-08).
 *
 * Usage:
 *   npx tsx scripts/audit-benefit-values.ts                       # dry-run (default)
 *   npx tsx scripts/audit-benefit-values.ts --dry-run             # explicit dry-run
 *   npx tsx scripts/audit-benefit-values.ts --apply corrections.json
 *
 * corrections.json shape: { "<benefitId>": <newValue>, ... }
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd()); // must run BEFORE any env-dependent module loads

// Env-dependent modules are imported dynamically inside main() because static
// `import` statements are hoisted above loadEnvConfig at runtime — and
// `src/lib/db.ts` reads DATABASE_URL at module-load to wire the better-sqlite3
// adapter (CONSTRAINT-11). Type-only imports are erased and safe at the top.
import { readFileSync } from "node:fs";

type DbModule = typeof import("../src/lib/db");

let prisma: DbModule["prisma"];

/** Sub-annual reset windows whose stored value should be PER-WINDOW, not annual. */
const SUB_ANNUAL_PERIODS = new Set(["monthly", "quarterly", "semiannual"]);

/** Description phrasings that hint the stored value is an annual cadence. */
const ANNUAL_CADENCE = /year|annual|annually|\/\s?yr|per year/i;

/** apply-mode error carrying the offending benefitId for context (EH-01/EH-05). */
class ApplyError extends Error {
  constructor(
    message: string,
    public readonly benefitId: string
  ) {
    super(message);
    this.name = "ApplyError";
  }
}

/**
 * Pure flag decision. resetPeriod "once"/"annual" is correct by definition
 * (the window IS the year / one-time). Sub-annual periods with a positive,
 * finite value are flagged for per-window confirmation.
 */
export function flagBenefit(b: {
  value: number | null;
  resetPeriod: string;
  description: string | null;
}): { flagged: boolean; reason: string } {
  if (!SUB_ANNUAL_PERIODS.has(b.resetPeriod)) {
    return { flagged: false, reason: "" };
  }
  if (b.value === null || !Number.isFinite(b.value) || b.value <= 0) {
    return { flagged: false, reason: "" };
  }

  let reason = `${b.resetPeriod} reset — confirm $${b.value} is per-window, not an annual total`;
  if (b.description && ANNUAL_CADENCE.test(b.description)) {
    reason += " (description mentions an annual cadence — likely needs dividing)";
  }
  return { flagged: true, reason };
}

type BenefitRow = {
  id: string;
  name: string;
  value: number | null;
  valueUnit: string;
  resetPeriod: string;
  description: string | null;
  userCard: { card: { issuer: string; name: string } };
};

function cardLabel(b: BenefitRow): string {
  return `${b.userCard.card.issuer} ${b.userCard.card.name}`;
}

function valueLabel(b: BenefitRow): string {
  if (b.value === null) return "unlimited";
  return b.valueUnit === "points" ? `${b.value} points` : `$${b.value}`;
}

function printListing(benefits: BenefitRow[]): void {
  const byCard = new Map<string, BenefitRow[]>();
  for (const b of benefits) {
    const label = cardLabel(b);
    if (!byCard.has(label)) byCard.set(label, []);
    byCard.get(label)!.push(b);
  }

  console.log("=== All benefits ===");
  for (const [label, rows] of byCard) {
    console.log(`\n${label}`);
    for (const b of rows) {
      console.log(
        `  - ${b.name.padEnd(40).slice(0, 40)} | ${valueLabel(b).padEnd(14)} | ${b.resetPeriod}`
      );
    }
  }
}

function printFlagged(
  flagged: { row: BenefitRow; reason: string }[]
): void {
  console.log("\n=== ⚠ FLAGGED — review per-window value ===");
  if (!flagged.length) {
    console.log("(none)");
    return;
  }
  for (const { row, reason } of flagged) {
    console.log(
      [
        `benefitId: ${row.id}`,
        `card: ${cardLabel(row)}`,
        `name: ${row.name}`,
        `value: ${valueLabel(row)}`,
        `resetPeriod: ${row.resetPeriod}`,
        `reason: ${reason}`,
      ].join("\n  ")
    );
    console.log("");
  }
}

async function runDryRun(benefits: BenefitRow[]): Promise<void> {
  printListing(benefits);

  const flagged = benefits
    .map((row) => ({ row, ...flagBenefit(row) }))
    .filter((r) => r.flagged)
    .map((r) => ({ row: r.row, reason: r.reason }));

  printFlagged(flagged);

  console.log(
    `\nSummary: ${benefits.length} benefit(s) seen, ${flagged.length} flagged. (DRY-RUN — no DB writes performed)`
  );
}

function loadCorrections(path: string): Record<string, number> {
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const corrections: Record<string, number> = {};
  for (const [id, val] of Object.entries(parsed)) {
    if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
      throw new ApplyError(
        `Invalid correction value for benefit (must be a finite number > 0, got ${JSON.stringify(val)})`,
        id
      );
    }
    corrections[id] = val;
  }
  return corrections;
}

async function runApply(path: string): Promise<void> {
  const corrections = loadCorrections(path);
  const ids = Object.keys(corrections);
  if (!ids.length) {
    console.log("No corrections in file — nothing to apply.");
    return;
  }

  const existing = await prisma.benefit.findMany({
    where: { id: { in: ids } },
    select: { id: true, value: true },
  });
  const oldValues = new Map(existing.map((b) => [b.id, b.value]));

  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      if (!oldValues.has(id)) {
        throw new ApplyError(`Benefit not found in app DB — aborting`, id);
      }
      const newValue = corrections[id];
      await tx.benefit.update({ where: { id }, data: { value: newValue } });
      console.log(`${id}: ${oldValues.get(id)} -> ${newValue}`);
    }
  });

  console.log(`\nApplied ${ids.length} correction(s). usedAmount and periods untouched (CONSTRAINT-08).`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing from environment — aborting.");
  }

  // Dynamic import — must follow loadEnvConfig (see top-of-file note).
  ({ prisma } = await import("../src/lib/db"));

  const applyIdx = process.argv.indexOf("--apply");
  if (applyIdx !== -1) {
    const path = process.argv[applyIdx + 1];
    if (!path) {
      throw new Error("--apply requires a path to a corrections JSON file.");
    }
    await runApply(path);
  } else {
    const benefits = await prisma.benefit.findMany({
      include: { userCard: { include: { card: true } } },
      orderBy: { createdAt: "asc" },
    });
    await runDryRun(benefits as BenefitRow[]);
  }

  await prisma.$disconnect();
}

// Only run the CLI when executed directly (npx tsx ...). When imported by the
// unit test to exercise `flagBenefit`, the entry point must NOT fire.
if (process.env.VITEST !== "true") {
  main().catch((err) => {
    const ctx = err instanceof ApplyError ? ` [benefitId=${err.benefitId}]` : "";
    console.error(
      `[fatal] audit-benefit-values aborted${ctx}:`,
      err instanceof Error ? err.stack : err
    );
    process.exit(1);
  });
}
