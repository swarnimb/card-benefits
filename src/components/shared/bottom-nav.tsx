"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-6">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "group relative flex flex-col items-center gap-0.5 px-3 py-1.5",
                "transition-all duration-200 ease-out",
                "active:scale-90"
              )}
            >
              {/* Active indicator pill */}
              <span
                className={cn(
                  "absolute -top-1 h-0.5 w-8 rounded-full transition-all duration-300 ease-out",
                  isActive
                    ? "scale-x-100 bg-primary opacity-100"
                    : "scale-x-0 bg-transparent opacity-0"
                )}
              />

              <span
                className={cn(
                  "flex items-center justify-center rounded-xl p-1.5 transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </span>

              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide transition-colors duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Safe area padding for phones with home indicators */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
