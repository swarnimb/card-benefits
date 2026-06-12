"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DemoRedirect } from "@/components/demo/demo-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Demo: login is unreachable — bounce to the overview (no /api/auth calls).
  if (isDemoMode) return <DemoRedirect to="/overview" />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Invalid credentials");
      return;
    }

    router.push("/overview");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "#F9F9F8" }}
        >
          CardMaxxer
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#9CA3AF" }}>
          Sign in to your dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium"
            style={{ color: "#9CA3AF" }}
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="h-12 bg-[#1A1917] border-[#252321] text-[#F9F9F8]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium"
            style={{ color: "#9CA3AF" }}
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="h-12 bg-[#1A1917] border-[#252321] text-[#F9F9F8]"
          />
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: "#F87171" }}>
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 mt-2 font-medium"
          style={{ backgroundColor: "#1a56db", color: "#F9F9F8" }}
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
