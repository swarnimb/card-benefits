import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function Home() {
  const tutorialState = await prisma.appState.findUnique({
    where: { key: "tutorial_seen" },
  });

  const tutorialSeen = tutorialState?.value === "true";

  if (tutorialSeen) {
    redirect("/dashboard");
  } else {
    redirect("/onboarding");
  }
}
