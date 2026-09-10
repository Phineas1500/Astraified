import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/index";
import {
  createSessionToken,
  isSessionTokenValid,
  readHostedAccessConfig,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  type HostedAccessEnvironment,
} from "../server/hosted-access";

const ORIGIN = "https://astraified-demo.vercel.app";
// Deliberately non-production fixture credentials.
const environment: HostedAccessEnvironment = {
  ASTRAIFIED_PUBLIC_ORIGINS: ORIGIN,
  ASTRAIFIED_ACCESS_CODE: "test-fixture-invitation-code-only",
  ASTRAIFIED_SESSION_SECRET: "test-fixture-session-signing-secret-only",
};
const configured = readHostedAccessConfig(environment);
if (!configured.enabled) throw new Error("Expected hosted test configuration");
const config = configured;
const JOB_ID = "1bc86730-7366-4bc6-806e-206bf55b3570";
const PRIVATE_MARKER = "Private source quotation from a saved lesson.";
const servers: Server[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function start(hostedEnvironment: HostedAccessEnvironment = environment) {
  const directory = await mkdtemp(join(tmpdir(), "astraified-hosted-test-"));
  directories.push(directory);
  await writeFile(
    join(directory, `${JOB_ID}.json`),
    JSON.stringify({
      version: 1,
      id: JOB_ID,
      topic: "A private lesson",
      level: "Beginner",
      status: "cancelled",
      stage: "learning",
      progress: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: [
        { id: "private-source", title: "Private notes", text: PRIVATE_MARKER },
      ],
      warnings: [PRIVATE_MARKER],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      attempts: { learning: 0, story: 0 },
      repairs: 0,
    }),
  );
  const app = createApp({
    hostedEnvironment,
    episodeJobs: { directory, getApiKey: () => undefined },
  });
  const server = await new Promise<Server>((resolve, reject) => {
    const running = app.listen(0, "127.0.0.1", (error) =>
      error ? reject(error) : resolve(running),
    );
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function sessionCookie(token = createSessionToken(config)) {
  return `${SESSION_COOKIE}=${token}`;
}

function login(
  base: string,
  accessCode: unknown = environment.ASTRAIFIED_ACCESS_CODE,
  headers: Record<string, string> = {},
) {
  return fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: JSON.stringify({ accessCode }),
  });
}

describe("hosted configuration and signed sessions", () => {
  it("keeps the all-unset local mode and validates exact explicit hosted origins", () => {
    expect(readHostedAccessConfig({})).toEqual({ enabled: false });
    expect(
      readHostedAccessConfig({
        ...environment,
        ASTRAIFIED_PUBLIC_ORIGINS: `${ORIGIN}, http://127.0.0.1:5173, http://localhost:5173`,
      }),
    ).toMatchObject({
      enabled: true,
      origins: [ORIGIN, "http://127.0.0.1:5173", "http://localhost:5173"],
    });
  });

  it("fails closed for partial configuration, short secrets and malformed origins", () => {
    const invalid: HostedAccessEnvironment[] = [
      { ASTRAIFIED_PUBLIC_ORIGINS: "" },
      { ASTRAIFIED_PUBLIC_ORIGINS: ORIGIN },
      { ASTRAIFIED_ACCESS_CODE: environment.ASTRAIFIED_ACCESS_CODE },
      { ASTRAIFIED_SESSION_SECRET: environment.ASTRAIFIED_SESSION_SECRET },
      { ...environment, ASTRAIFIED_ACCESS_CODE: "too-short" },
      { ...environment, ASTRAIFIED_SESSION_SECRET: "too-short" },
      ...[
        "http://public.example",
        `${ORIGIN}/`,
        `${ORIGIN}/path`,
        `${ORIGIN}?foo=1`,
        "https://user@public.example",
        "https://*.vercel.app",
        "null",
        `${ORIGIN},`,
      ].map((origin) => ({
        ...environment,
        ASTRAIFIED_PUBLIC_ORIGINS: origin,
      })),
    ];
    for (const value of invalid)
      expect(() =>
        createApp({ hostedEnvironment: value, episodeJobs: false }),
      ).toThrow("Hosted access requires");
  });

  it("requires an intact canonical signature and a current 12-hour session", () => {
    const now = 1_789_066_800_000;
    const token = createSessionToken(config, now);
    expect(isSessionTokenValid(config, token, now)).toBe(true);
    expect(isSessionTokenValid(config, token, now + SESSION_TTL_MS - 1)).toBe(
      true,
    );
    expect(isSessionTokenValid(config, token, now + SESSION_TTL_MS)).toBe(
      false,
    );
    expect(isSessionTokenValid(config, token, now - 1)).toBe(false);
    for (const bad of [
      undefined,
      "",
      "unsigned",
      token + "extra",
      token.replace("v1", "v2"),
      token.slice(0, -10),
      token.replace(/\.[A-Za-z0-9_-]{43}$/, `.${"A".repeat(43)}`),
      token.replace(String(now), String(now + 1000)),
    ])
      expect(isSessionTokenValid(config, bad, now)).toBe(false);
    expect(
      isSessionTokenValid(
        { ...config, accessCode: "different-fixture-invitation-code" },
        token,
        now,
      ),
    ).toBe(false);
    expect(
      isSessionTokenValid(
        {
          ...config,
          sessionSecret: "different-fixture-session-signing-secret",
        },
        token,
        now,
      ),
    ).toBe(false);
  });
});

describe("protected API and session endpoints (no paid calls)", () => {
  it("keeps local sessions optional and local health available with all settings absent", async () => {
    const base = await start({});
    expect(await (await fetch(`${base}/api/session`)).json()).toEqual({
      authenticationRequired: false,
      authenticated: true,
    });
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  });

  it("exposes only public session status before sign-in and never caches it", async () => {
    const base = await start();
    const response = await fetch(`${base}/api/session`);
    expect(await response.json()).toEqual({
      authenticationRequired: true,
      authenticated: false,
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vary")).toContain("Cookie");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("blocks every API surface before job contents, uploads, or generation", async () => {
    const base = await start();
    for (const [method, path] of [
      ["GET", "/api/health"],
      ["GET", `/api/episodes/jobs/${JOB_ID}`],
      ["GET", "/api/episodes/jobs/unknown"],
      ["POST", "/api/episodes/jobs"],
      ["POST", `/api/episodes/jobs/${JOB_ID}/cancel`],
      ["POST", `/api/episodes/jobs/${JOB_ID}/resume`],
      ["POST", "/api/generate"],
    ]) {
      const response = await fetch(base + path, {
        method,
        headers: { Origin: ORIGIN },
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: { code: "authentication_required", message: expect.any(String) },
      });
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }
  });

  it("rejects bad, expired, tampered and duplicate cookies before returning a saved job", async () => {
    const base = await start();
    const good = createSessionToken(config);
    for (const Cookie of [
      sessionCookie("bad"),
      sessionCookie(createSessionToken(config, Date.now() - SESSION_TTL_MS)),
      sessionCookie(good.replace("v1", "v2")),
      `${sessionCookie(good)}; ${sessionCookie(good)}`,
    ]) {
      const response = await fetch(`${base}/api/episodes/jobs/${JOB_ID}`, {
        headers: { Cookie },
      });
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain(PRIVATE_MARKER);
    }
    const response = await fetch(`${base}/api/episodes/jobs/${JOB_ID}`, {
      headers: { Cookie: sessionCookie(good) },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).job.warnings).toEqual([PRIVATE_MARKER]);
  });

  it("signs in with a host-only, Secure, HttpOnly, strict session cookie", async () => {
    const base = await start();
    const response = await login(base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticationRequired: true,
      authenticated: true,
    });
    const setCookie = response.headers.get("Set-Cookie")!;
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    for (const attribute of [
      "Path=/api",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=43200",
    ])
      expect(setCookie).toContain(attribute);
    expect(setCookie).not.toContain("Domain=");
    expect(setCookie).not.toContain(environment.ASTRAIFIED_ACCESS_CODE);
    expect(setCookie).not.toContain(environment.ASTRAIFIED_SESSION_SECRET);
    const Cookie = setCookie.split(";")[0];
    expect(
      await (
        await fetch(`${base}/api/session`, { headers: { Cookie } })
      ).json(),
    ).toEqual({ authenticationRequired: true, authenticated: true });
    expect(
      (await fetch(`${base}/api/health`, { headers: { Cookie } })).status,
    ).toBe(200);
  });

  it("does not accept the wrong access code or oversized/malformed login requests", async () => {
    const base = await start();
    const wrong = await login(base, "wrong-code");
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("Set-Cookie")).toBeNull();
    expect((await login(base, null)).status).toBe(400);
    expect((await login(base, "x".repeat(2_000))).status).toBe(413);
    const malformed = await fetch(`${base}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: "{bad json",
    });
    expect(malformed.status).toBe(400);
  });

  it("requires the exact configured Origin for login without trusting proxy headers", async () => {
    const base = await start();
    for (const headers of [
      {},
      { Origin: "https://attacker.example" },
      { Origin: `${ORIGIN}.attacker.example` },
      { Origin: `${ORIGIN}/path` },
      { Origin: "null" },
      {
        "X-Forwarded-Host": "astraified-demo.vercel.app",
        "X-Forwarded-Proto": "https",
      },
      { Origin: ORIGIN, "Sec-Fetch-Site": "cross-site" },
    ] as Record<string, string>[]) {
      const response = await fetch(`${base}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          accessCode: environment.ASTRAIFIED_ACCESS_CODE,
        }),
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("Set-Cookie")).toBeNull();
    }
  });

  it("requires an allowed Origin for every hosted mutation even with a valid cookie", async () => {
    const base = await start();
    const Cookie = sessionCookie();
    for (const path of [
      "/api/episodes/jobs",
      `/api/episodes/jobs/${JOB_ID}/cancel`,
      `/api/episodes/jobs/${JOB_ID}/resume`,
      "/api/generate",
    ]) {
      for (const headers of [
        { Cookie },
        { Cookie, Origin: "https://unrelated.example" },
      ] as Record<string, string>[]) {
        const response = await fetch(base + path, { method: "POST", headers });
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe("invalid_origin");
      }
    }
    const allowed = await fetch(`${base}/api/episodes/jobs/${JOB_ID}/cancel`, {
      method: "POST",
      headers: { Cookie, Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    });
    expect(allowed.status).toBe(200);
    const create = await fetch(`${base}/api/episodes/jobs`, {
      method: "POST",
      headers: { Cookie, Origin: ORIGIN },
      body: new FormData(),
    });
    expect(create.status).toBe(503);
    expect((await create.json()).error.code).toBe("api_not_configured");
  });

  it("denies unrelated or cross-site reads even if a client manually supplies a cookie", async () => {
    const base = await start();
    for (const headers of [
      { Cookie: sessionCookie(), Origin: "https://unrelated.example" },
      { Cookie: sessionCookie(), "Sec-Fetch-Site": "cross-site" },
    ] as Record<string, string>[]) {
      const response = await fetch(`${base}/api/episodes/jobs/${JOB_ID}`, {
        headers,
      });
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(PRIVATE_MARKER);
    }
  });

  it("limits sign-in attempts globally despite forged client IP headers", async () => {
    const base = await start();
    for (let i = 0; i < 10; i++)
      expect(
        (
          await login(base, "incorrect", {
            "X-Forwarded-For": `198.51.100.${i}`,
          })
        ).status,
      ).toBe(401);
    const response = await login(base);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("requires the configured Origin for logout and clears the same protected cookie", async () => {
    const base = await start();
    const Cookie = sessionCookie();
    expect(
      (
        await fetch(`${base}/api/session`, {
          method: "DELETE",
          headers: { Cookie },
        })
      ).status,
    ).toBe(403);
    const response = await fetch(`${base}/api/session`, {
      method: "DELETE",
      headers: { Cookie, Origin: ORIGIN },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticationRequired: true,
      authenticated: false,
    });
    const cleared = response.headers.get("Set-Cookie")!;
    expect(cleared).toContain(`${SESSION_COOKIE}=;`);
    expect(cleared).toContain("Path=/api");
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
    expect(cleared).toContain("Secure");
    expect(cleared).not.toContain("Domain=");
    const status = await fetch(`${base}/api/session`, {
      headers: { Cookie: cleared.split(";")[0] },
    });
    expect((await status.json()).authenticated).toBe(false);
  });
});
