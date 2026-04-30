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
      <main className="pb-16">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </>
  );
}
