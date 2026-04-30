"use client";

import { useRef, useState, useEffect } from "react";
import type { UserCardWithBenefits } from "@/types/card";
import { CardItem } from "@/components/cards/card-item";

const PEEK_RATIO = 0.4;

export interface CardStackProps {
  cards: UserCardWithBenefits[];
  expandedId: string | null;
  onExpand: (id: string) => void;
}

export function CardStack({ cards, expandedId, onExpand }: CardStackProps) {
  const firstCardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (firstCardRef.current) {
        setCardHeight(firstCardRef.current.clientHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const peekHeight = Math.round(cardHeight * PEEK_RATIO);
  const overlap = cardHeight > 0 ? cardHeight - peekHeight : 0;

  return (
    <div
      className="overflow-y-auto hide-scrollbar flex justify-center"
      style={{
        height: "calc(100dvh - 64px)",
        paddingTop: 24,
        paddingBottom: 32,
        opacity: expandedId ? 0.3 : 1,
        transition: "opacity 0.3s ease",
        pointerEvents: expandedId ? "none" : "auto",
      }}
    >
      <div style={{ width: "80%" }}>
        {cards.map((card, index) => {
          const isLast = index === cards.length - 1;
          const stackMargin = isLast ? 0 : -overlap;

          return (
            <div
              key={card.id}
              ref={index === 0 ? firstCardRef : undefined}
              style={{
                position: "relative",
                zIndex: index + 1,
                marginBottom: stackMargin,
              }}
            >
              <CardItem
                userCard={card}
                benefits={card.benefits}
                isExpanded={false}
                onTap={() => onExpand(card.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
