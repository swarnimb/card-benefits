/**
 * One-off backfill: re-classify Benefit rows currently stuck at
 * classification = 'one-time-bonus' AND tracked = false.
 *
 * Reuses the existing parser (Haiku + tool_use, CONSTRAINT-09) and the
 * deterministic deriveTracked policy (src/lib/parser/classification.ts).
 *
 * Writes ONLY `classification` and `tracked` per CONSTRAINT-07.
 *
 * Usage:
 *   npx tsx scripts/backfill-classification.ts            # writes to DB
 *   npx tsx scripts/backfill-classification.ts --dry-run  # no writes
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd()); // must run BEFORE any env-dependent module loads

// Env-dependent modules are imported dynamically inside main() because static
// `import` statements are hoisted above loadEnvConfig at runtime — and
// `src/lib/db.ts` reads DATABASE_URL at module-load to wire the better-sqlite3
// adapter (CONSTRAINT-11). Type-only imports are erased and safe at the top.
import type { BenefitClassification } from "../src/lib/parser/classification";

type DbModule = typeof import("../src/lib/db");
type ParserModule = typeof import("../src/lib/parser");
type ClassificationModule = typeof import("../src/lib/parser/classification");

let prisma: DbModule["prisma"];
let parseBenefits: ParserModule["parseBenefits"];
let deriveTracked: ClassificationModule["deriveTracked"];

const DRY_RUN = process.argv.includes("--dry-run");

type Row = {
  id: string;
  name: string;
  cardLabel: string;
  fromClass: BenefitClassification;
  toClass: BenefitClassification;
  fromTracked: boolean;
  toTracked: boolean;
};

function suffix(id: string): string {
  return id.length <= 6 ? id : id.slice(-6);
}

function formatRow(r: Row): string {
  return [
    suffix(r.id),
    r.cardLabel.padEnd(28).slice(0, 28),
    r.name.padEnd(40).slice(0, 40),
    `${r.fromClass} -> ${r.toClass}`.padEnd(48),
    `tracked: ${r.fromTracked}->${r.toTracked}`,
  ].join(" | ");
}

async function processBenefit(b: {
  id: string;
  name: string;
  description: string | null;
  classification: string;
  tracked: boolean;
  userCard: { card: { issuer: string; name: string } };
}): Promise<Row | null> {
  const cardLabel = `${b.userCard.card.issuer} ${b.userCard.card.name}`;
  const rawText = `${b.name}. ${b.description ?? "(no description provided)"}`;

  const drafts = await parseBenefits(rawText);
  if (!drafts.length) {
    console.warn(
      `[skip] parser returned 0 drafts for id=${b.id} name="${b.name}" card="${cardLabel}"`
    );
    return null;
  }

  const draft = drafts[0];
  const newClass = draft.classification;
  const newTracked = deriveTracked(newClass);

  return {
    id: b.id,
    name: b.name,
    cardLabel,
    fromClass: b.classification as BenefitClassification,
    toClass: newClass,
    fromTracked: b.tracked,
    toTracked: newTracked,
  };
}

async function runBackfill(
  benefits: Parameters<typeof processBenefit>[0][]
): Promise<{ updated: number; skipped: number; errors: number }> {
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const b of benefits) {
    try {
      const row = await processBenefit(b);
      if (!row) {
        skipped++;
        continue;
      }

      console.log(formatRow(row));

      const classChanged = row.fromClass !== row.toClass;
      const trackedChanged = row.fromTracked !== row.toTracked;
      if (!classChanged && !trackedChanged) {
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        await prisma.benefit.update({
          where: { id: b.id },
          data: { classification: row.toClass, tracked: row.toTracked },
        });
      }
      updated++;
    } catch (err) {
      errors++;
      const stack = err instanceof Error ? err.stack : String(err);
      console.error(
        `[error] backfill failed for id=${b.id} name="${b.name}" card="${b.userCard.card.issuer} ${b.userCard.card.name}"\n${stack}`
      );
    }
  }

  return { updated, skipped, errors };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing from environment — aborting.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing from environment — aborting.");
  }

  // Dynamic imports — must follow loadEnvConfig (see top-of-file note).
  ({ prisma } = await import("../src/lib/db"));
  ({ parseBenefits } = await import("../src/lib/parser"));
  ({ deriveTracked } = await import("../src/lib/parser/classification"));

  const benefits = await prisma.benefit.findMany({
    where: { classification: "one-time-bonus", tracked: false },
    include: { userCard: { include: { card: true } } },
  });

  console.log(
    `Found ${benefits.length} benefit(s) matching (classification='one-time-bonus' AND tracked=false).${DRY_RUN ? " [DRY-RUN]" : ""}`
  );
  console.log("");

  const { updated, skipped, errors } = await runBackfill(benefits);

  console.log("");
  const suffixMsg = DRY_RUN ? " (DRY-RUN — no DB writes performed)" : "";
  console.log(`${updated} updated, ${skipped} skipped, ${errors} errors${suffixMsg}`);

  await prisma.$disconnect();

  if (errors > 0 && !DRY_RUN) process.exit(1);
}

main().catch((err) => {
  console.error("[fatal] backfill aborted:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
