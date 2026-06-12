import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * Task 91: auth bypass in demo mode.
 *
 * `isDemoMode` is build-time inlined and read at import time, so each case
 * resets the module registry, stubs the env var, and dynamically imports a
 * fresh copy of the page/layout (same pattern as demo-mode.unit.test.ts).
 */

const { mockAuth, mockRequireAuth, mockRedirect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireAuth: vi.fn(),
  // Mirror next/navigation: redirect() throws and never returns.
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
  requireAuth: mockRequireAuth,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  useRouter: vi.fn(),
}));

// Guard logic only — keep the layout's client children out of scope.
vi.mock("@/components/shared/bottom-nav", () => ({
  BottomNav: () => null,
}));
vi.mock("@/components/shared/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => {
  vi.resetModules();
  mockAuth.mockClear();
  mockRequireAuth.mockClear();
  mockRedirect.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demo mode (NEXT_PUBLIC_DEMO_MODE=true)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
  });

  it("RootPage renders a client redirect to /overview without any auth call", async () => {
    const RootPage = (await import("@/app/page")).default;
    const { DemoRedirect } = await import("@/components/demo/demo-redirect");

    const element = (await RootPage()) as ReactElement<{ to: string }>;

    expect(element.type).toBe(DemoRedirect);
    expect(element.props.to).toBe("/overview");
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("AppLayout renders children without a session fetch or redirect", async () => {
    const AppLayout = (await import("@/app/(app)/layout")).default;

    const element = await AppLayout({ children: "demo-child" });

    expect(element).toBeTruthy();
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("DashboardPage renders without requireAuth", async () => {
    const DashboardPage = (await import("@/app/dashboard/page")).default;

    const element = await DashboardPage();

    expect(element).toBeTruthy();
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });
});

describe("non-demo mode (flag absent)", () => {
  it("RootPage redirects unauthenticated visitors to /login", async () => {
    mockAuth.mockResolvedValue(null);
    const RootPage = (await import("@/app/page")).default;

    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("RootPage redirects authenticated visitors to /overview", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_test" } });
    const RootPage = (await import("@/app/page")).default;

    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT:/overview");
    expect(mockRedirect).toHaveBeenCalledWith("/overview");
  });

  it("AppLayout redirects unauthenticated visitors to /login", async () => {
    mockAuth.mockResolvedValue(null);
    const AppLayout = (await import("@/app/(app)/layout")).default;

    await expect(AppLayout({ children: "child" })).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("AppLayout renders children when a session exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_test" } });
    const AppLayout = (await import("@/app/(app)/layout")).default;

    const element = await AppLayout({ children: "child" });

    expect(element).toBeTruthy();
    expect(mockAuth).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
