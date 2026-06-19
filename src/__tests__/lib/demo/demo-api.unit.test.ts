import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";

/**
 * Task 90: apiFetch branches on the build-time inlined isDemoMode constant,
 * so every case resets the module registry, stubs the env var, and
 * dynamically imports a fresh copy (same pattern as demo-mode.unit.test.ts).
 */
type DemoApiModule = typeof import("@/lib/demo/demo-api");

async function importDemoApi(demo: boolean): Promise<DemoApiModule> {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", demo ? "true" : undefined);
  return import("@/lib/demo/demo-api");
}

function stubFetch(handler: (url: string) => Response | Promise<Response>): Mock {
  const mock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function fixtureFetchStub(fixtures: Record<string, unknown>): Mock {
  return stubFetch((url) => {
    const match = /\/card-benefits\/demo-fixtures\/(.+)\.json$/.exec(url);
    const payload = match ? fixtures[match[1]] : undefined;
    if (payload === undefined) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(payload), { status: 200 });
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiFetch — non-demo passthrough", () => {
  it("delegates GETs to the real fetch untouched and returns its response", async () => {
    const real = new Response("{}", { status: 200 });
    const mock = stubFetch(() => real);
    const { apiFetch } = await importDemoApi(false);

    const res = await apiFetch("/api/overview");

    expect(res).toBe(real);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith("/api/overview", undefined);
  });

  it("delegates non-GETs (init forwarded verbatim) without blocking or emitting", async () => {
    const mock = stubFetch(() => new Response(null, { status: 204 }));
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(false);
    const listener = vi.fn();
    subscribeDemoBlocked(listener);
    const init = { method: "POST", body: JSON.stringify({ catalogCardId: "c1" }) };

    const res = await apiFetch("/api/user-cards", init);

    expect(res.status).toBe(204);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith("/api/user-cards", init);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("apiFetch — demo GETs resolve from static fixtures", () => {
  it("serves /api/overview from the basePath-prefixed overview fixture", async () => {
    const overview = { needsAttention: [{ benefitId: "b1" }], onTrack: [], done: [] };
    const mock = fixtureFetchStub({ overview });
    const { apiFetch } = await importDemoApi(true);

    const res = await apiFetch("/api/overview");

    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual(overview);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith("/card-benefits/demo-fixtures/overview.json");
  });

  it("serves user-cards, portfolio stats, and catalog from their fixtures", async () => {
    fixtureFetchStub({
      "user-cards": [{ id: "uc1" }],
      "portfolio-stats": { annualFeeTotal: 2060 },
      catalog: [{ id: "cat1" }],
    });
    const { apiFetch } = await importDemoApi(true);

    expect(await (await apiFetch("/api/user-cards")).json()).toEqual([{ id: "uc1" }]);
    expect(await (await apiFetch("/api/portfolio/stats")).json()).toEqual({ annualFeeTotal: 2060 });
    expect(await (await apiFetch("/api/catalog")).json()).toEqual([{ id: "cat1" }]);
  });

  it("serves /api/user-cards/{id}/benefits from the keyed benefits-by-card fixture", async () => {
    fixtureFetchStub({ "benefits-by-card": { uc1: [{ id: "b1" }], uc2: [{ id: "b2" }] } });
    const { apiFetch } = await importDemoApi(true);

    expect(await (await apiFetch("/api/user-cards/uc2/benefits")).json()).toEqual([{ id: "b2" }]);
  });

  it("throws loudly naming the URL when the keyed card id is missing", async () => {
    fixtureFetchStub({ "benefits-by-card": { uc1: [] } });
    const { apiFetch } = await importDemoApi(true);

    await expect(apiFetch("/api/user-cards/nope/benefits")).rejects.toThrow(
      /benefits-by-card\.json.*"nope"/,
    );
  });

  it("throws loudly naming the URL when a fixture file is missing (no silent empty UI)", async () => {
    fixtureFetchStub({}); // every fixture 404s
    const { apiFetch } = await importDemoApi(true);

    await expect(apiFetch("/api/overview")).rejects.toThrow(
      /\/card-benefits\/demo-fixtures\/overview\.json.*HTTP 404/,
    );
  });

  it("throws on an unmapped /api GET instead of returning empty data", async () => {
    fixtureFetchStub({});
    const { apiFetch } = await importDemoApi(true);

    await expect(apiFetch("/api/does-not-exist")).rejects.toThrow(
      /no fixture mapped for GET \/api\/does-not-exist/,
    );
  });
});

describe("apiFetch — demo interactive writes succeed as no-ops", () => {
  it("usage POST and tracked PATCH resolve ok with zero network (no revert path)", async () => {
    const mock = fixtureFetchStub({});
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(true);
    const listener = vi.fn();
    subscribeDemoBlocked(listener);

    const usage = await apiFetch("/api/benefits/b1/usage", { method: "POST", body: "{}" });
    const tracked = await apiFetch("/api/benefits/b1", { method: "PATCH", body: "{}" });

    expect(usage.ok).toBe(true);
    expect(tracked.ok).toBe(true);
    expect(mock).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("activation PATCH echoes activatedAt the way ActivationToggle reads it", async () => {
    const { apiFetch } = await importDemoApi(true);

    const on = await apiFetch("/api/benefits/b1/activation", {
      method: "PATCH",
      body: JSON.stringify({ activated: true }),
    });
    const off = await apiFetch("/api/benefits/b1/activation", {
      method: "PATCH",
      body: JSON.stringify({ activated: false }),
    });

    expect(on.ok).toBe(true);
    expect((await on.json()).activatedAt).toEqual(expect.any(String));
    expect((await off.json()).activatedAt).toBeNull();
  });
});

describe("apiFetch — demo blocks every other write", () => {
  it("returns an ok=false 'Read-only demo' response and fires the blocked emitter", async () => {
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(true);
    const listener = vi.fn();
    subscribeDemoBlocked(listener);

    const res = await apiFetch("/api/user-cards", { method: "POST", body: "{}" });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Read-only demo" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("covers delete, confirm, and unknown future endpoints generically", async () => {
    vi.useFakeTimers();
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(true);
    const listener = vi.fn();
    subscribeDemoBlocked(listener);

    const paths: Array<[string, string]> = [
      ["/api/user-cards/uc1", "DELETE"],
      ["/api/benefits/confirm", "POST"],
      ["/api/some-future-endpoint", "PUT"],
    ];
    for (const [path, method] of paths) {
      vi.advanceTimersByTime(5_000); // step past the debounce window per call
      expect((await apiFetch(path, { method })).ok).toBe(false);
    }
    expect(listener).toHaveBeenCalledTimes(paths.length);
  });

  it("re-scrape is a silent no-op success (empty result, NO emit) so the scan animation plays", async () => {
    // The admin flow shows the read-only modal itself once the scan settles
    // (scan-then-modal) — the scrape call must NOT block or emit.
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(true);
    const listener = vi.fn();
    subscribeDemoBlocked(listener);

    const res = await apiFetch("/api/user-cards/uc1/scrape", { method: "POST" });

    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ benefits: [], annualFee: null });
    expect(listener).not.toHaveBeenCalled();
  });

  it("debounces rapid blocked clicks into a single emit", async () => {
    vi.useFakeTimers();
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(true);
    const listener = vi.fn();
    subscribeDemoBlocked(listener);

    await apiFetch("/api/user-cards", { method: "POST" });
    await apiFetch("/api/user-cards", { method: "POST" });
    await apiFetch("/api/user-cards/uc1", { method: "DELETE" });
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    await apiFetch("/api/user-cards", { method: "POST" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("subscribeDemoBlocked returns a working unsubscribe", async () => {
    const { apiFetch, subscribeDemoBlocked } = await importDemoApi(true);
    const listener = vi.fn();
    const unsubscribe = subscribeDemoBlocked(listener);
    unsubscribe();

    await apiFetch("/api/user-cards", { method: "POST" });

    expect(listener).not.toHaveBeenCalled();
  });
});
