"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";

export function NavWrapper() {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");

  if (isOnboarding) return null;

  return <BottomNav />;
}
