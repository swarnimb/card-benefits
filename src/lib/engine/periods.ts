import { prisma } from "@/lib/db";
import type { BenefitPeriod } from "@prisma/client";

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
    if (!statementDay) throw new Error("calculatePeriodBoundary: statementDay required for statement anchor");
    return calcStatementBoundary(now, statementDay);
  }

  if (resetAnchor === "anniversary") {
    if (!anniversaryDate) throw new Error("calculatePeriodBoundary: anniversaryDate required for anniversary anchor");
    return calcAnniversaryBoundary(now, anniversaryDate);
  }

  throw new Error(`calculatePeriodBoundary: unsupported resetPeriod="${resetPeriod}" resetAnchor="${resetAnchor}"`);
}

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
