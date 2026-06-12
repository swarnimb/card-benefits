/**
 * Task 89 — pins the global clock for deterministic fixture generation.
 *
 * The period engine reads `new Date()` / `Date.now()` internally (no injectable
 * `now`), so the only way to generate a reproducible snapshot — where the
 * engine still owns every period boundary — is to pin the clock for the
 * duration of seeding + fixture building. No period rows are hand-crafted:
 * the engine computes real boundaries for the pinned instant.
 *
 * The replacement subclasses the real Date, so instances pass `instanceof Date`
 * checks made by Prisma and the engine. Always restored in `finally`.
 */
export async function withPinnedDate<T>(fixedMs: number, fn: () => Promise<T>): Promise<T> {
  const RealDate = globalThis.Date;

  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedMs); // `new Date()` → the pinned instant
      } else {
        super(...(args as [])); // explicit-argument constructors behave normally
      }
    }

    static now(): number {
      return fixedMs;
    }
  }

  globalThis.Date = PinnedDate as unknown as DateConstructor;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}
