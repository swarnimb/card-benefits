import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TutorialScreenProps {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
}

export function TutorialScreen({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  description,
}: TutorialScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 text-center">
      {/* Icon container with colored background */}
      <div
        className={cn(
          "mb-8 flex h-32 w-32 items-center justify-center rounded-3xl",
          "shadow-lg transition-transform duration-500",
          iconBgColor
        )}
      >
        <Icon className={cn("h-16 w-16", iconColor)} strokeWidth={1.5} />
      </div>

      <h2 className="mb-3 text-2xl font-bold tracking-tight">{title}</h2>

      <p className="max-w-xs text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
