import { prisma } from "@/lib/db";
import type { BenefitPeriod } from "@prisma/client";

/** Thrown when period calculation or creation fails. Includes function name and benefit context. */
export class PeriodEngineError extends Error {
  fn: string;
  benefitId: string;

  constructor({ message, fn, benefitId, cause }: { message: string; fn: string; benefitId: string; cause?: unknown }) {
    super(message, { cause });
    this.name = "PeriodEngineError";
    this.fn = fn;
    this.benefitId = benefitId;
  }
}

function eod(date: Date): Date {
  date.setHours(23, 59, 59, 999);
  return date;
}

function calcCalendarBoundary(
  resetPeriod: string,
  year: number,
  month: number
): { periodStart: Date; periodEnd: Date | null } {
  if (resetPeriod === "monthly") {
    return { periodStart: new Date(year, month, 1), periodEnd: eod(new Date(year, month + 1, 0)) };
  }
  if (resetPeriod === "quarterly") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      periodStart: new Date(year, quarterStartMonth, 1),
      periodEnd: eod(new Date(year, quarterStartMonth + 3, 0)),
    };
  }
  if (resetPeriod === "semiannual") {
    const halfStartMonth = Math.floor(month / 6) * 6;
    return {
      periodStart: new Date(year, halfStartMonth, 1),
      periodEnd: eod(new Date(year, halfStartMonth + 6, 0)),
    };
  }
  // annual
  return { periodStart: new Date(year, 0, 1), periodEnd: eod(new Date(year, 11, 31)) };
}

function calcStatementBoundary(
  now: Date,
  statementDay: number
): { periodStart: Date; periodEnd: Date | null } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const stmtMonth = day < statementDay ? month - 1 : month;
  const stmtYear = stmtMonth < 0 ? year - 1 : year;
  const start = new Date(stmtYear, (stmtMonth + 12) % 12, statementDay);
  const nextClose = new Date(stmtYear, (stmtMonth + 12) % 12 + 1, statementDay);
  return {
    periodStart: start,
    periodEnd: eod(new Date(nextClose.getFullYear(), nextClose.getMonth(), nextClose.getDate() - 1)),
  };
}

function calcSemiannualStatementBoundary(
  now: Date,
  statementDay: number
): { periodStart: Date; periodEnd: Date | null } {
  // Find the most recent statement open: shift back one month if current day < statementDay.
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const stmtMonth = now.getDate() < statementDay ? baseMonth - 1 : baseMonth;
  const anchorYear = stmtMonth < 0 ? baseYear - 1 : baseYear;
  const anchorMonth = (stmtMonth + 12) % 12;
  // Align to a 6-month boundary measured from the anchor month modulo 6.
  const cycleOffset = ((anchorMonth % 6) + 6) % 6;
  const startMonthIndex = anchorMonth - cycleOffset; // can be negative — Date constructor handles overflow
  const start = new Date(anchorYear, startMonthIndex, statementDay);
  const nextClose = new Date(anchorYear, startMonthIndex + 6, statementDay);
  return {
    periodStart: start,
    periodEnd: eod(new Date(nextClose.getFullYear(), nextClose.getMonth(), nextClose.getDate() - 1)),
  };
}

function calcAnniversaryBoundary(
  now: Date,
  anniversaryDate: Date
): { periodStart: Date; periodEnd: Date | null } {
  const year = now.getFullYear();
  const anniversaryMonth = anniversaryDate.getMonth();
  const anniversaryDay = anniversaryDate.getDate();
  const thisYearAnniversary = new Date(year, anniversaryMonth, anniversaryDay);
  const [start, next] = now >= thisYearAnniversary
    ? [thisYearAnniversary, new Date(year + 1, anniversaryMonth, anniversaryDay)]
    : [new Date(year - 1, anniversaryMonth, anniversaryDay), thisYearAnniversary];
  return {
    periodStart: start,
    periodEnd: eod(new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1)),
  };
}

function calcSemiannualAnniversaryBoundary(
  now: Date,
  anniversaryDate: Date
): { periodStart: Date; periodEnd: Date | null } {
  // Two 6-month windows per anniversary year: H1 = anniv..+6mo, H2 = +6mo..+12mo.
  const year = now.getFullYear();
  const anniversaryMonth = anniversaryDate.getMonth();
  const anniversaryDay = anniversaryDate.getDate();
  const thisYearAnniversary = new Date(year, anniversaryMonth, anniversaryDay);
  const annivStart = now >= thisYearAnniversary
    ? thisYearAnniversary
    : new Date(year - 1, anniversaryMonth, anniversaryDay);
  const midpoint = new Date(annivStart.getFullYear(), annivStart.getMonth() + 6, annivStart.getDate());
  const nextAnniv = new Date(annivStart.getFullYear() + 1, annivStart.getMonth(), annivStart.getDate());
  const [start, next] = now < midpoint ? [annivStart, midpoint] : [midpoint, nextAnniv];
  return {
    periodStart: start,
    periodEnd: eod(new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1)),
  };
}

/**
 * Pure function — computes the current period's start/end dates based on reset rules.
 * @throws PeriodEngineError if required anchor data (statementDay/anniversaryDate) is missing.
 */
export function calculatePeriodBoundary(
  resetPeriod: string,
  resetAnchor: string,
  now: Date,
  statementDay?: number,
  anniversaryDate?: Date
): { periodStart: Date; periodEnd: Date | null } {
  if (resetPeriod === "once") return { periodStart: now, periodEnd: null };

  if (resetAnchor === "calendar") {
    return calcCalendarBoundary(resetPeriod, now.getFullYear(), now.getMonth());
  }

  if (resetAnchor === "statement") {
    if (!statementDay) throw new PeriodEngineError({ message: "statementDay required for statement anchor", fn: "calculatePeriodBoundary", benefitId: "n/a" });
    if (resetPeriod === "semiannual") return calcSemiannualStatementBoundary(now, statementDay);
    return calcStatementBoundary(now, statementDay);
  }

  if (resetAnchor === "anniversary") {
    if (!anniversaryDate) throw new PeriodEngineError({ message: "anniversaryDate required for anniversary anchor", fn: "calculatePeriodBoundary", benefitId: "n/a" });
    if (resetPeriod === "semiannual") return calcSemiannualAnniversaryBoundary(now, anniversaryDate);
    return calcAnniversaryBoundary(now, anniversaryDate);
  }

  throw new PeriodEngineError({ message: `unsupported resetPeriod="${resetPeriod}" resetAnchor="${resetAnchor}"`, fn: "calculatePeriodBoundary", benefitId: "n/a" });
}

/** Returns the current open period for a benefit, creating or rolling over as needed. */
export async function ensureCurrentPeriod(benefitId: string): Promise<BenefitPeriod> {
  try {
    const now = new Date();

    const benefit = await prisma.benefit.findUniqueOrThrow({
      where: { id: benefitId },
      include: { userCard: true },
    });

    const open = await prisma.benefitPeriod.findFirst({
      where: { benefitId, status: "open" },
      orderBy: { createdAt: "desc" },
    });

    if (open && (open.periodEnd === null || open.periodEnd > now)) {
      return open;
    }

    if (open) {
      await prisma.benefitPeriod.update({
        where: { id: open.id },
        data: { status: "closed" },
      });
    }

    const { periodStart, periodEnd } = calculatePeriodBoundary(
      benefit.resetPeriod,
      benefit.resetAnchor,
      now,
      benefit.userCard.statementDay ?? undefined,
      benefit.userCard.anniversaryDate ?? undefined,
    );

    return prisma.benefitPeriod.create({
      data: { benefitId, periodStart, periodEnd, usedAmount: 0, status: "open" },
    });
  } catch (err) {
    throw new PeriodEngineError({
      message: `ensureCurrentPeriod failed for benefitId="${benefitId}"`,
      fn: "ensureCurrentPeriod",
      benefitId,
      cause: err,
    });
  }
}
