import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  await requireAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F0E0D] text-white">
      <h1 className="text-2xl font-semibold">CardMaxxer</h1>
      <p className="mt-2 text-sm text-neutral-400">Dashboard coming soon.</p>
    </main>
  );
}
