import { requireAuth } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/demo-mode";

export default async function DashboardPage() {
  // Demo (static export): no server auth — requireAuth() would break the build.
  if (!isDemoMode) await requireAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F0E0D] text-white">
      <h1 className="text-2xl font-semibold">CardMaxxer</h1>
      <p className="mt-2 text-sm text-neutral-400">Dashboard coming soon.</p>
    </main>
  );
}
