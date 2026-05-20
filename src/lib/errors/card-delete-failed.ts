/**
 * Named error thrown when DELETE /api/user-cards/[id] fails — currently used
 * by the admin page's fresh-add Cancel rollback path (NEW-1). Carries the
 * userCardId + HTTP status so the BenefitReviewGate can surface a loud,
 * contextual message instead of silently swallowing (EH-01/02/05).
 */
export class CardDeleteFailedError extends Error {
  constructor(
    public readonly userCardId: string,
    public readonly httpStatus: number,
    public readonly bodyText: string,
  ) {
    super(
      `Could not roll back orphan card ${userCardId}: ` +
        `DELETE /api/user-cards/${userCardId} returned HTTP ${httpStatus}` +
        (bodyText ? ` — ${bodyText}` : ""),
    );
    this.name = "CardDeleteFailedError";
  }
}
