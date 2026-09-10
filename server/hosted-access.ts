import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import express from "express";

export interface HostedAccessEnvironment {
  ASTRAIFIED_PUBLIC_ORIGINS?: string;
  ASTRAIFIED_ACCESS_CODE?: string;
  ASTRAIFIED_SESSION_SECRET?: string;
}

export type HostedAccessConfig =
  | { enabled: false }
  | {
      enabled: true;
      origins: string[];
      accessCode: string;
      sessionSecret: string;
    };

export const SESSION_COOKIE = "__Secure-astraified-session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 10;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const CONFIG_KEYS = [
  "ASTRAIFIED_PUBLIC_ORIGINS",
  "ASTRAIFIED_ACCESS_CODE",
  "ASTRAIFIED_SESSION_SECRET",
] as const;

/** Supplying any hosted setting enables validation; incomplete setup never opens the API. */
export function readHostedAccessConfig(
  environment: HostedAccessEnvironment = process.env,
): HostedAccessConfig {
  if (CONFIG_KEYS.every((key) => environment[key] === undefined))
    return { enabled: false };
  const accessCode = environment.ASTRAIFIED_ACCESS_CODE || "";
  const sessionSecret = environment.ASTRAIFIED_SESSION_SECRET || "";
  const origins = (environment.ASTRAIFIED_PUBLIC_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim());
  const validOrigin = (origin: string) => {
    try {
      const parsed = new URL(origin);
      return (
        parsed.origin === origin &&
        !parsed.username &&
        !parsed.password &&
        !parsed.hostname.includes("*") &&
        (parsed.protocol === "https:" ||
          (parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname)))
      );
    } catch {
      return false;
    }
  };
  if (
    !/^[!-~]{24,256}$/.test(accessCode) ||
    !/^[!-~]{32,512}$/.test(sessionSecret) ||
    !origins.length ||
    !origins.every(validOrigin)
  )
    throw new Error(
      "Hosted access requires exact HTTPS origins (or explicit loopback HTTP origins), a random ASTRAIFIED_ACCESS_CODE of at least 24 characters, and a random ASTRAIFIED_SESSION_SECRET of at least 32 characters. No API was started.",
    );
  return {
    enabled: true,
    origins: [...new Set(origins)],
    accessCode,
    sessionSecret,
  };
}

type EnabledConfig = Extract<HostedAccessConfig, { enabled: true }>;

function signature(config: EnabledConfig, value: string): Buffer {
  // Rotating either secret invalidates existing sessions.
  return createHmac("sha256", config.sessionSecret)
    .update(config.accessCode)
    .update("\0")
    .update(value)
    .digest();
}

export function createSessionToken(
  config: EnabledConfig,
  now = Date.now(),
): string {
  const payload = `v1.${Math.floor(now)}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signature(config, payload).toString("base64url")}`;
}

export function isSessionTokenValid(
  config: EnabledConfig,
  value: string | undefined,
  now = Date.now(),
): boolean {
  if (!value) return false;
  const match = /^(v1\.(\d{13})\.[A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(
    value,
  );
  if (!match) return false;
  const expected = signature(config, match[1]);
  const actual = Buffer.from(match[3], "base64url");
  // A canonical encoding prevents multiple representations of the same signature.
  if (
    actual.length !== expected.length ||
    actual.toString("base64url") !== match[3] ||
    !timingSafeEqual(actual, expected)
  )
    return false;
  const issuedAt = Number(match[2]);
  return now >= issuedAt && now < issuedAt + SESSION_TTL_MS;
}

function sessionToken(request: express.Request): string | undefined {
  const cookies = (request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  // Reject duplicate cookie names instead of trusting proxy/parser ordering.
  return cookies.length === 1
    ? cookies[0].slice(SESSION_COOKIE.length + 1)
    : undefined;
}

function error(
  response: express.Response,
  status: number,
  code: string,
  message: string,
) {
  return response.status(status).json({ error: { code, message } });
}

export function createHostedAccess(
  config: HostedAccessConfig,
  now: () => number = Date.now,
) {
  const router = express.Router();
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/api",
  };
  const authenticated = (request: express.Request) =>
    !config.enabled ||
    isSessionTokenValid(config, sessionToken(request), now());
  const sessionView = (request: express.Request) => ({
    authenticationRequired: config.enabled,
    authenticated: authenticated(request),
  });
  const allowedOrigin = (request: express.Request) =>
    config.enabled &&
    typeof request.headers.origin === "string" &&
    config.origins.includes(request.headers.origin) &&
    request.headers["sec-fetch-site"] !== "cross-site";

  const requireWriteOrigin: express.RequestHandler = (
    request,
    response,
    next,
  ) => {
    if (config.enabled && !allowedOrigin(request))
      return error(
        response,
        403,
        "invalid_origin",
        "Open the Astraified website to change your session or generate adventures.",
      );
    next();
  };

  // A bounded global limiter fits this shared private workspace. Forwarded IP
  // headers are deliberately ignored, so a caller cannot rotate them to evade it.
  let loginWindow = now();
  let loginAttempts = 0;
  const limitLogin: express.RequestHandler = (_request, response, next) => {
    if (!config.enabled) return next();
    if (now() >= loginWindow + LOGIN_WINDOW_MS) {
      loginWindow = now();
      loginAttempts = 0;
    }
    if (loginAttempts >= LOGIN_ATTEMPTS) {
      response.setHeader(
        "Retry-After",
        Math.max(1, Math.ceil((loginWindow + LOGIN_WINDOW_MS - now()) / 1000)),
      );
      return error(
        response,
        429,
        "login_rate_limited",
        "Too many sign-in attempts. Please try again in a few minutes.",
      );
    }
    loginAttempts += 1;
    next();
  };

  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    response.vary("Cookie");
    next();
  });
  router.get("/", (request, response) => response.json(sessionView(request)));
  router.post(
    "/",
    requireWriteOrigin,
    limitLogin,
    express.json({ limit: "1kb", strict: true, inflate: false }),
    (request, response) => {
      if (!config.enabled) return response.json(sessionView(request));
      const supplied = request.body?.accessCode;
      if (typeof supplied !== "string" || supplied.length > 256)
        return error(
          response,
          400,
          "invalid_access_code",
          "Enter your invitation code.",
        );
      const actual = createHash("sha256").update(supplied).digest();
      const expected = createHash("sha256").update(config.accessCode).digest();
      if (!timingSafeEqual(actual, expected))
        return error(
          response,
          401,
          "invalid_access_code",
          "That invitation code did not match. Please try again.",
        );
      response.cookie(SESSION_COOKIE, createSessionToken(config, now()), {
        ...cookieOptions,
        maxAge: SESSION_TTL_MS,
      });
      return response.json({
        authenticationRequired: true,
        authenticated: true,
      });
    },
  );
  router.delete("/", requireWriteOrigin, (_request, response) => {
    if (config.enabled) response.clearCookie(SESSION_COOKIE, cookieOptions);
    response.json({
      authenticationRequired: config.enabled,
      authenticated: !config.enabled,
    });
  });
  router.use(
    (
      cause: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = (cause as { status?: number })?.status;
      return error(
        response,
        status === 413 ? 413 : 400,
        "invalid_session_request",
        "Send only your invitation code as a small JSON request.",
      );
    },
  );

  const protectApi: express.RequestHandler = (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    response.vary("Cookie");
    if (!config.enabled) return next();
    // Authenticate before resolving any job ID, reading its source or accepting uploads.
    if (!authenticated(request))
      return error(
        response,
        401,
        "authentication_required",
        "Enter your invitation code to connect to adventure generation.",
      );
    const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (
      (write && !allowedOrigin(request)) ||
      (request.headers.origin && !allowedOrigin(request)) ||
      request.headers["sec-fetch-site"] === "cross-site"
    )
      return error(
        response,
        403,
        "invalid_origin",
        "Open the Astraified website to access adventure generation.",
      );
    next();
  };
  return { sessionRouter: router, protectApi };
}
