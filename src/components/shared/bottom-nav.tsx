"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CreditCard, Settings } from "lucide-react";

const TABS = [
  { href: "/overview", label: "Overview", Icon: LayoutGrid },
  { href: "/cards", label: "Cards", Icon: CreditCard },
  { href: "/admin", label: "Admin", Icon: Settings },
] as const;

/** Bottom navigation bar — fixed, full-width, 3 tabs (Overview / Cards / Admin). */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 w-full z-50 bg-background border-t border-border"
      aria-label="Main navigation"
    >
      <div className="flex">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon size={24} aria-hidden="true" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
