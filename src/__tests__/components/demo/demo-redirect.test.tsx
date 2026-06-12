import { describe, it, expect, afterEach, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { DemoRedirect } from "@/components/demo/demo-redirect";

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  mockReplace.mockClear();
  mockPush.mockClear();
});

describe("DemoRedirect", () => {
  it("client-redirects to the target route on mount", async () => {
    render(<DemoRedirect to="/overview" />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/overview"));
  });

  it("renders nothing", () => {
    const { container } = render(<DemoRedirect to="/overview" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("LoginPage in demo mode", () => {
  it("redirects to /overview and never renders the sign-in form", async () => {
    // isDemoMode is read at import time — stub the env, then import fresh.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const LoginPage = (await import("@/app/(auth)/login/page")).default;

    const { container } = render(<LoginPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/overview"));
    expect(container.querySelector("form")).toBeNull();
  });
});
