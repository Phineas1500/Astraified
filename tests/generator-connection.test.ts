import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generatorRetryDelay,
  parseGeneratorHealth,
  parseGeneratorSession,
  readGeneratorJson,
  requestGeneratorJson,
} from "../src/games/generator-connection";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("generator connection responses", () => {
  it("distinguishes unlocked local, locked hosted, and authenticated hosted sessions", () => {
    for (const session of [
      { authenticationRequired: false, authenticated: true },
      { authenticationRequired: true, authenticated: false },
      { authenticationRequired: true, authenticated: true },
    ])
      expect(parseGeneratorSession(session)).toEqual(session);
  });

  it("fails closed when a proxy response is not the session contract", () => {
    for (const value of [
      null,
      [],
      { authenticated: true },
      { authenticationRequired: "false", authenticated: true },
    ])
      expect(() => parseGeneratorSession(value)).toThrowError(
        expect.objectContaining({ kind: "offline" }),
      );
  });

  it("distinguishes an unconfigured generator from a valid connection", () => {
    expect(
      parseGeneratorHealth({ ok: true, configured: false, model: "example" }),
    ).toEqual({ configured: false });
    expect(parseGeneratorHealth({ ok: true, configured: true })).toEqual({
      configured: true,
    });
    for (const value of [
      { ok: false, configured: true },
      { ok: true },
      "online",
    ])
      expect(() => parseGeneratorHealth(value)).toThrowError(
        expect.objectContaining({ kind: "offline" }),
      );
  });

  it.each([200, 502, 503, 530])(
    "turns an HTML proxy response (%s) into a friendly offline error",
    async (status) => {
      const response = new Response(
        "<html>Cloud proxy stack trace and internal host</html>",
        { status },
      );
      await expect(readGeneratorJson(response)).rejects.toMatchObject({
        kind: "offline",
        message:
          "The generator is unreachable. Your adventures are still available to play.",
      });
    },
  );

  it("opens access-code entry on a 401 even if the response has no JSON", async () => {
    await expect(
      readGeneratorJson(new Response("", { status: 401 })),
    ).rejects.toMatchObject({ kind: "locked" });
  });

  it("preserves useful source errors without marking the generator offline", async () => {
    await expect(
      readGeneratorJson(
        Response.json(
          {
            error: {
              code: "source_error",
              message: "This page has no readable text.",
            },
          },
          { status: 400 },
        ),
      ),
    ).rejects.toMatchObject({
      kind: "request",
      message: "This page has no readable text.",
    });
  });

  it("accepts successful cookie-session JSON and empty logout responses", async () => {
    const session = { authenticationRequired: true, authenticated: true };
    await expect(readGeneratorJson(Response.json(session))).resolves.toEqual(
      session,
    );
    await expect(
      readGeneratorJson(new Response(null, { status: 204 })),
    ).resolves.toEqual({});
  });

  it("uses same-origin cookies and never caches session or progress requests", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await requestGeneratorJson("/api/health");
    expect(fetch).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("classifies network failures as offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(requestGeneratorJson("/api/session")).rejects.toMatchObject({
      kind: "offline",
    });
  });

  it("allows a slow source upload beyond normal polling timeout, while still bounding it", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("Timed out", "TimeoutError")),
        milliseconds,
      );
      return controller.signal;
    });
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const signal = init.signal!;
        signals.push(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      }),
    );
    const progress = requestGeneratorJson("/api/episodes/jobs/existing").catch(
      (error) => error,
    );
    const upload = requestGeneratorJson(
      "/api/episodes/jobs",
      { method: "POST", body: new FormData() },
      120_000,
    ).catch((error) => error);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(await progress).toMatchObject({ kind: "offline" });
    expect(signals[1].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(signals[1].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(50_000);
    expect(signals[1].aborted).toBe(true);
    expect(await upload).toMatchObject({ kind: "offline" });
  });

  it("does not reinterpret deliberate cancellation as a disconnection", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");
    controller.abort(reason);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(reason));
    await expect(
      requestGeneratorJson("/api/session", { signal: controller.signal }),
    ).rejects.toBe(reason);
  });

  it("backs off reconnect attempts with a 15-second cap", () => {
    expect([1, 2, 3, 4, 5, 50].map(generatorRetryDelay)).toEqual([
      1800, 3600, 7200, 14400, 15000, 15000,
    ]);
  });
});
