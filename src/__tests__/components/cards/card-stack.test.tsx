import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CardStack } from "@/components/cards/card-stack";
import type { UserCardWithBenefits } from "@/types/card";

afterEach(() => cleanup());

vi.mock("framer-motion", () => {
  const motionValue = () => ({ get: () => 0, set: () => {} });
  return {
    motion: {
      div: ({ animate: _a, transition: _t, whileTap: _w, layoutId: _l, ...rest }: React.HTMLAttributes<HTMLDivElement> & { animate?: unknown; transition?: unknown; whileTap?: unknown; layoutId?: unknown }) => (
        <div {...rest} />
      ),
    },
    useScroll: () => ({ scrollY: motionValue() }),
    useTransform: () => motionValue(),
    useReducedMotion: () => false,
  };
});

function makeCard(n: number): UserCardWithBenefits {
  return {
    id: `card-${n}`,
    userId: "user_test",
    cardId: `catalog-${n}`,
    displayOrder: n,
    lastVerifiedAt: null,
    statementDay: null,
    anniversaryDate: null,
    createdAt: new Date(),
    card: {
      id: `catalog-${n}`,
      issuer: "Chase",
      name: `Card ${n}`,
      scrapeUrl: null,
      defaultColor: "#117ACA",
    },
    benefits: [],
  };
}

const TEN_CARDS = Array.from({ length: 10 }, (_, i) => makeCard(i));
const ONE_CARD = [makeCard(0)];

describe("CardStack", () => {
  it("renders all cards without error", () => {
    render(
      <CardStack
        cards={TEN_CARDS}
        expandedId={null}
        onExpand={vi.fn()}
      />
    );
    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("renders single card without error", () => {
    render(
      <CardStack
        cards={ONE_CARD}
        expandedId={null}
        onExpand={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Chase Card 0")).toBeDefined();
  });
});
