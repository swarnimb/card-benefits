import { prisma } from "@/lib/db";
import { ensureCurrentPeriod } from "@/lib/engine/periods";
import type { Benefit, BenefitPeriod } from "@prisma/client";

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
    if (period === null) {
      // ensureCurrentPeriod returns null only for set-and-forget benefits.
      // usedAmount does not apply to them (no BenefitPeriod; CONSTRAINT-17).
      throw new UsageEngineError({
        message: `updateBenefitUsage does not apply to set-and-forget benefit "${benefitId}"`,
        fn: "updateBenefitUsage",
        benefitId,
        newAmount,
      });
    }
    const benefit = await prisma.benefit.findUniqueOrThrow({ where: { id: benefitId } });

    const clamped = benefit.value !== null
      ? Math.max(0, Math.min(newAmount, benefit.value))
      : Math.max(0, newAmount);

    return prisma.benefitPeriod.update({
      where: { id: period.id },
      data: { usedAmount: clamped },
    });
  } catch (err) {
    if (err instanceof UsageEngineError) throw err; // already contextual — don't re-wrap
    throw new UsageEngineError({
      message: `updateBenefitUsage failed for benefitId="${benefitId}"`,
      fn: "updateBenefitUsage",
      benefitId,
      newAmount,
      cause: err,
    });
  }
}

/** Thrown when a set-and-forget activation toggle fails. Includes benefit ID and attempted state. */
export class ActivationEngineError extends Error {
  fn: string;
  benefitId: string;
  activated: boolean;

  constructor({ message, benefitId, activated, cause }: {
    message: string;
    benefitId: string;
    activated: boolean;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "ActivationEngineError";
    this.fn = "setBenefitActivation";
    this.benefitId = benefitId;
    this.activated = activated;
  }
}

/**
 * The ONLY function that writes Benefit.activatedAt (CONSTRAINT-16).
 * Sets activatedAt to now when activating, or null when deactivating.
 * Touches no usedAmount and creates no BenefitPeriod. Set-and-forget benefits only.
 */
export async function setBenefitActivation(
  benefitId: string,
  activated: boolean
): Promise<Benefit> {
  let benefit: Benefit | null;
  try {
    benefit = await prisma.benefit.findUnique({ where: { id: benefitId } });
  } catch (err) {
    throw new ActivationEngineError({
      message: `setBenefitActivation lookup failed for benefitId="${benefitId}"`,
      benefitId,
      activated,
      cause: err,
    });
  }

  if (!benefit) {
    throw new ActivationEngineError({
      message: `setBenefitActivation: benefit not found for benefitId="${benefitId}"`,
      benefitId,
      activated,
    });
  }
  if (!benefit.setAndForget) {
    throw new ActivationEngineError({
      message: `setBenefitActivation: benefit "${benefitId}" is not set-and-forget; activation does not apply`,
      benefitId,
      activated,
    });
  }

  try {
    return await prisma.benefit.update({
      where: { id: benefitId },
      data: { activatedAt: activated ? new Date() : null },
    });
  } catch (err) {
    throw new ActivationEngineError({
      message: `setBenefitActivation update failed for benefitId="${benefitId}"`,
      benefitId,
      activated,
      cause: err,
    });
  }
}
