import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DemoRedirect } from "@/components/demo/demo-redirect";

export default async function RootPage() {
  // Demo (static export): no server, no auth — client-redirect to the demo home.
  if (isDemoMode) return <DemoRedirect to="/overview" />;

  const session = await auth();
  if (session) redirect("/overview");
  redirect("/login");
}
