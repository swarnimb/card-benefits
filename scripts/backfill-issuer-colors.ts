/**
 * One-time backfill: migrate Card.defaultColor from the OLD catalog seeds to the
 * Feature 9 design tokens (Task 64 / CONSTRAINT-22).
 *
 * Safe + idempotent: only rows whose defaultColor exactly equals a known OLD seed
 * are updated. Custom-card colors (#64748b) and any genuine user override are left
 * untouched. Wells Fargo has no Feature 9 token → not in the map → unchanged.
 * Running a second time is a no-op (old seeds no longer present).
 *
 * Run: npx tsx scripts/backfill-issuer-colors.ts
 */
import Database from "better-sqlite3";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

/** OLD catalog seed hex → Feature 9 token hex. */
const COLOR_MAP: Record<string, string> = {
  "#1a56db": "#3B5BDB", // Chase
  "#B8952A": "#C9A961", // Amex
  "#9b1c1c": "#B73A3A", // Capital One
  "#1e40af": "#2E5BC9", // Citi
  "#c2410c": "#E0741F", // Discover
};

const DB_FILES = ["prisma/dev.db", "dev.db"];
const STAMP = "20260604-task64";

function distribution(db: Database.Database): Record<string, number> {
  const rows = db
    .prepare("SELECT defaultColor AS c, COUNT(*) AS n FROM Card GROUP BY defaultColor")
    .all() as { c: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.c, r.n]));
}

let exitCode = 0;
for (const rel of DB_FILES) {
  const path = resolve(process.cwd(), rel);
  if (!existsSync(path)) {
    console.warn(`[skip] ${rel} not found`);
    continue;
  }

  const backup = `${path}.bak-${STAMP}`;
  copyFileSync(path, backup);
  console.log(`\n=== ${rel} ===`);
  console.log(`[backup] ${backup}`);

  const db = new Database(path);
  try {
    const before = distribution(db);
    console.log("[before]", JSON.stringify(before));

    let totalChanged = 0;
    const update = db.prepare(
      "UPDATE Card SET defaultColor = ? WHERE defaultColor = ?"
    );
    const tx = db.transaction(() => {
      for (const [oldHex, newHex] of Object.entries(COLOR_MAP)) {
        const info = update.run(newHex, oldHex);
        if (info.changes > 0) {
          console.log(`  ${oldHex} -> ${newHex}: ${info.changes} row(s)`);
        }
        totalChanged += info.changes;
      }
    });
    tx();

    const after = distribution(db);
    console.log("[after] ", JSON.stringify(after));
    console.log(`[done] ${totalChanged} row(s) updated`);

    // Safety check: no OLD seed should remain.
    const leftover = Object.keys(COLOR_MAP).filter((h) => h in after);
    if (leftover.length > 0) {
      console.error(`[FAIL] old seeds still present: ${leftover.join(", ")}`);
      exitCode = 1;
    }
  } finally {
    db.close();
  }
}

process.exit(exitCode);
