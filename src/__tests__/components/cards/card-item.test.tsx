import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CardItem } from "@/components/cards/card-item";
import type { UserCardWithCard } from "@/types/card";
import type { BenefitWithPeriod } from "@/types/benefit";

afterEach(() => cleanup());

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      style,
      onClick,
      className,
      "aria-label": ariaLabel,
    }: React.HTMLAttributes<HTMLDivElement> & { style?: object }) => (
      <div style={style as React.CSSProperties} onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => false,
}));

const BASE_CARD: UserCardWithCard = {
  id: "card-1",
  userId: "user_test",
  cardId: "catalog-1",
  displayOrder: 0,
  lastVerifiedAt: null,
  statementDay: null,
  anniversaryDate: null,
  createdAt: new Date(),
  card: {
    id: "catalog-1",
    issuer: "Chase",
    name: "Sapphire Reserve",
    scrapeUrl: null,
    defaultColor: "#117ACA",
  },
};

function makeBenefit(overrides: Partial<BenefitWithPeriod> = {}): BenefitWithPeriod {
  return {
    id: "benefit-1",
    userCardId: "card-1",
    name: "Travel Credit",
    description: null,
    type: "credit",
    value: 300,
    valueUnit: "dollars",
    resetPeriod: "annual",
    resetAnchor: "calendar",
    category: "travel",
    classification: "discretionary-credit",
    tracked: true,
    createdAt: new Date(),
    currentPeriod: null,
    ...overrides,
  };
}

describe("CardItem", () => {
  it("shows expiring badge when any benefit isExpiringSoon", () => {
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days out
    const benefits = [
      makeBenefit({
        currentPeriod: {
          id: "period-1",
          periodStart: new Date(),
          periodEnd: soonDate,
          usedAmount: 0,
          status: "open",
        },
      }),
    ];

    render(
      <CardItem
        userCard={BASE_CARD}
        benefits={benefits}
        isExpanded={false}
        onTap={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Benefits expiring soon")).toBeDefined();
  });

  it("does not show expiring badge when no expiring benefits", () => {
    const farDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days out
    const benefits = [
      makeBenefit({
        currentPeriod: {
          id: "period-1",
          periodStart: new Date(),
          periodEnd: farDate,
          usedAmount: 0,
          status: "open",
        },
      }),
    ];

    render(
      <CardItem
        userCard={BASE_CARD}
        benefits={benefits}
        isExpanded={false}
        onTap={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Benefits expiring soon")).toBeNull();
  });
});
