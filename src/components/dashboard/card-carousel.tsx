"use client";

import { useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import type { UserCardWithCard } from "@/types/card";

interface CardCarouselProps {
  userCards: UserCardWithCard[];
  activeIndex: number;
  onCardChange: (index: number) => void;
}

export function CardCarousel({
  userCards,
  activeIndex,
  onCardChange,
}: CardCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    onCardChange(emblaApi.selectedScrollSnap());
  }, [emblaApi, onCardChange]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Sync external activeIndex changes to carousel position
  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex);
    }
  }, [emblaApi, activeIndex]);

  const networkLabel = (type: string) => {
    switch (type) {
      case "visa":
        return "VISA";
      case "mastercard":
        return "Mastercard";
      case "amex":
        return "AMEX";
      default:
        return type.toUpperCase();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Carousel viewport */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {userCards.map((uc, i) => (
            <div
              key={uc.id}
              className={cn(
                "min-w-0 flex-[0_0_85%] pl-4 transition-opacity duration-300",
                i === activeIndex ? "opacity-100" : "opacity-50"
              )}
            >
              <div
                className="relative aspect-[1.586/1] overflow-hidden rounded-2xl p-5 shadow-lg"
                style={{ backgroundColor: uc.card.imageColor }}
              >
                {/* Chip */}
                <div className="flex flex-col gap-1">
                  <div className="h-8 w-10 rounded-md bg-white/20 backdrop-blur-sm" />
                  <div className="h-1.5 w-6 rounded-full bg-white/10" />
                </div>

                {/* Decorative arcs */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/5" />

                {/* Card info */}
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold leading-tight text-white drop-shadow-sm">
                      {uc.card.cardName}
                    </p>
                    <p className="mt-0.5 text-sm text-white/70">
                      {uc.card.bankName}
                    </p>
                  </div>
                  <span className="text-xs font-semibold tracking-wider text-white/50">
                    {networkLabel(uc.card.cardType)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {userCards.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {userCards.map((uc, i) => (
            <button
              key={uc.id}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === activeIndex
                  ? "h-2 w-6 bg-primary"
                  : "h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to ${uc.card.cardName}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
