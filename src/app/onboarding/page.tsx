"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialScreen } from "@/components/onboarding/tutorial-screen";
import { cn } from "@/lib/utils";

const screens = [
  {
    icon: CreditCard,
    iconColor: "text-blue-600",
    iconBgColor: "bg-blue-50",
    title: "All Your Cards, One View",
    description:
      "See every benefit across all your credit cards in a single swipeable dashboard. No more app-hopping.",
  },
  {
    icon: BarChart3,
    iconColor: "text-emerald-600",
    iconBgColor: "bg-emerald-50",
    title: "Track What You Use",
    description:
      "Import your transactions and instantly see which benefits you're using — and which ones you're leaving on the table.",
  },
  {
    icon: Sparkles,
    iconColor: "text-amber-600",
    iconBgColor: "bg-amber-50",
    title: "Never Miss a Perk",
    description:
      "Monthly credits, annual perks, points multipliers — stay on top of every benefit before it resets or expires.",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState(0);

  const isLastScreen = currentScreen === screens.length - 1;

  const goToCardSelection = useCallback(() => {
    router.push("/onboarding/select");
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLastScreen) {
      goToCardSelection();
    } else {
      setCurrentScreen((prev) => prev + 1);
    }
  }, [isLastScreen, goToCardSelection]);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToCardSelection}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Screen carousel */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-400 ease-out"
          style={{ transform: `translateX(-${currentScreen * 100}%)` }}
        >
          {screens.map((screen, i) => (
            <div key={i} className="h-full w-full flex-shrink-0">
              <TutorialScreen {...screen} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-6 px-8 pb-12">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {screens.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentScreen(i)}
              aria-label={`Go to screen ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === currentScreen
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        {/* Action button */}
        <Button
          onClick={handleNext}
          size="lg"
          className={cn(
            "w-full max-w-xs text-base font-semibold",
            "transition-all duration-200 active:scale-95",
            isLastScreen && "bg-emerald-600 hover:bg-emerald-700"
          )}
        >
          {isLastScreen ? "Get Started" : "Next"}
        </Button>
      </div>
    </div>
  );
}
