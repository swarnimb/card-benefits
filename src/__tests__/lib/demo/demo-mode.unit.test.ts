import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Task 87: isDemoMode is a build-time inlined constant read at import time,
 * so each case must reset the module registry, stub the env var, and
 * dynamically import a fresh copy of the module.
 */
async function importIsDemoMode(): Promise<boolean> {
  const mod = await import("@/lib/demo/demo-mode");
  return mod.isDemoMode;
}

describe("isDemoMode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true when NEXT_PUBLIC_DEMO_MODE === "true"', async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(await importIsDemoMode()).toBe(true);
  });

  it("is false when NEXT_PUBLIC_DEMO_MODE is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined);
    expect(await importIsDemoMode()).toBe(false);
  });

  it("is false for any other value (e.g. \"1\", \"TRUE\", \"false\")", async () => {
    for (const value of ["1", "TRUE", "false", ""]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", value);
      expect(await importIsDemoMode()).toBe(false);
    }
  });
});
