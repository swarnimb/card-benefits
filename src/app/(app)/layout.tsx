import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/shared/bottom-nav";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <BottomNav />
      {/* Mobile-first app shell: full-width on phones, centered ~420px column on
          desktop (MVP is desktop-only but designed at 375px). The fixed BottomNav
          is constrained to the same column width. */}
      <main className="mx-auto w-full max-w-[420px] min-h-dvh border-x border-white/[0.06] pb-16">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </>
  );
}
