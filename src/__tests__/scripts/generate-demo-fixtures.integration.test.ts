/**
 * Task 89 — end-to-end happy path for `npm run demo:fixtures`.
 *
 * Runs the real generator as a child process (it pins its own clock and uses a
 * throwaway prisma/demo.db — it never touches this suite's DATABASE_URL), then
 * asserts the published fixtures exist, parse, match the live route shapes, and
 * populate all three Overview triage buckets.
 *
 * The error path (invalid dataset entry fails loudly naming the record) is unit
 * tested in src/__tests__/lib/demo/validate-demo-data.test.ts — the generator
 * runs that same validator before any DB write.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { OverviewData } from "@/types/api";
import type { PortfolioStats } from "@/types/api";

const ROOT = process.cwd();
const FIXTURES_DIR = join(ROOT, "src", "lib", "demo", "fixtures");
const FIXTURE_FILES = [
  "overview.json",
  "user-cards.json",
  "benefits-by-card.json",
  "portfolio-stats.json",
  "catalog.json",
] as const;

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8")) as T;
}

type UserCardFixture = { id: string; benefitCount: number; card: { annualFee: number | null } };
type BenefitFixture = {
  id: string;
  type: string;
  tracked: boolean;
  setAndForget: boolean;
  currentPeriod: { usedAmount: number; periodEnd: string | null; status: string } | null;
};

beforeAll(() => {
  // ~30-60s: migrate deploy + seed + build in a child process.
  execSync("npx tsx scripts/generate-demo-fixtures.ts", { cwd: ROOT, stdio: "pipe" });
}, 180_000);

describe("generate-demo-fixtures (end-to-end)", () => {
  it("publishes all five fixture files and they parse", () => {
    for (const file of FIXTURE_FILES) {
      expect(existsSync(join(FIXTURES_DIR, file)), `${file} missing`).toBe(true);
      expect(() => readFixture(file)).not.toThrow();
    }
  });

  it("removes the temp demo DB after generation", () => {
    expect(existsSync(join(ROOT, "prisma", "demo.db"))).toBe(false);
  });

  it("populates all three overview triage buckets with nonzero money at risk", () => {
    const overview = readFixture<OverviewData>("overview.json");
    expect(overview.needsAttention.length).toBeGreaterThan(0);
    expect(overview.onTrack.length).toBeGreaterThan(0);
    expect(overview.done.length).toBeGreaterThan(0);
    expect(overview.moneyAtRisk.totalUnredeemed).toBeGreaterThan(0);
    expect(overview.moneyAtRisk.soonestDaysUntilReset).not.toBeNull();
    expect(overview.sparkbar.length).toBe(overview.needsAttention.length);
    expect(overview.activeByCategory.length).toBeGreaterThan(0);
  });

  it("emits the 5 demo user-cards keyed 1:1 into benefits-by-card", () => {
    const userCards = readFixture<UserCardFixture[]>("user-cards.json");
    const byCard = readFixture<Record<string, BenefitFixture[]>>("benefits-by-card.json");

    expect(userCards).toHaveLength(5);
    expect(Object.keys(byCard).sort()).toEqual(userCards.map((c) => c.id).sort());
    for (const card of userCards) {
      expect(card.benefitCount).toBeGreaterThan(0);
      expect(byCard[card.id]).toHaveLength(card.benefitCount);
    }
  });

  it("gives periods only to tracked non-set-and-forget benefits (CONSTRAINT-17), with usage spread", () => {
    const byCard = readFixture<Record<string, BenefitFixture[]>>("benefits-by-card.json");
    const benefits = Object.values(byCard).flat();

    for (const b of benefits) {
      if (!b.tracked || b.setAndForget) {
        expect(b.currentPeriod, `benefit ${b.id} must have no period`).toBeNull();
      } else {
        expect(b.currentPeriod?.status).toBe("open");
      }
    }
    const used = benefits.filter((b) => (b.currentPeriod?.usedAmount ?? 0) > 0);
    const unused = benefits.filter((b) => b.currentPeriod !== null && b.currentPeriod.usedAmount === 0);
    expect(used.length).toBeGreaterThan(0);
    expect(unused.length).toBeGreaterThan(0);
  });

  it("computes portfolio stats from the seeded annual fees and engine periods", () => {
    const stats = readFixture<PortfolioStats>("portfolio-stats.json");
    // 695 + 550 + 395 + 325 + 95 — the five demo cards' annual fees.
    expect(stats.annualFeeTotal).toBe(2060);
    expect(stats.redeemedYtd).toBeGreaterThan(0);
    expect(stats.available).toBeGreaterThan(0);
  });

  it("snapshots the real add-card catalog", () => {
    const catalog = readFixture<{ id: string }[]>("catalog.json");
    const source = JSON.parse(readFileSync(join(ROOT, "data", "card-catalog.json"), "utf-8"));
    expect(catalog).toEqual(source);
    expect(catalog.length).toBeGreaterThan(0);
  });
});
