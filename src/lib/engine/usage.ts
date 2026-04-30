import { prisma } from "@/lib/db";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import type { BenefitPeriod } from "@prisma/client";

/** Thrown when a usage update fails. Includes benefit ID and attempted amount. */
export class UsageEngineError extends Error {
  fn: string;
  benefitId: string;
  newAmount: number;

  constructor({ message, fn, benefitId, newAmount, cause }: {
    message: string;
    fn: string;
    benefitId: string;
    newAmount: number;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "UsageEngineError";
    this.fn = fn;
    this.benefitId = benefitId;
    this.newAmount = newAmount;
  }
}

/** The ONLY function that writes usedAmount to the database. Clamps to [0, benefit.value]. */
export async function updateBenefitUsage(
  benefitId: string,
  newAmount: number
): Promise<BenefitPeriod> {
  try {
    const period = await ensureCurrentPeriod(benefitId);
    const benefit = await prisma.benefit.findUniqueOrThrow({ where: { id: benefitId } });

    const clamped = benefit.value !== null
      ? Math.max(0, Math.min(newAmount, benefit.value))
      : Math.max(0, newAmount);

    return prisma.benefitPeriod.update({
      where: { id: period.id },
      data: { usedAmount: clamped },
    });
  } catch (err) {
    throw new UsageEngineError({
      message: `updateBenefitUsage failed for benefitId="${benefitId}"`,
      fn: "updateBenefitUsage",
      benefitId,
      newAmount,
      cause: err,
    });
  }
}
