import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

afterEach(() => cleanup());

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import { signIn } from "next-auth/react";

describe("LoginPage", () => {
  it("shows error message on failed sign-in", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: "CredentialsSignin", ok: false } as never);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpassword" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeDefined();
    });
  });

  it("disables button while submitting", async () => {
    vi.mocked(signIn).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null, ok: true } as never), 100))
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /signing in/i });
      expect(button).toBeDefined();
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
