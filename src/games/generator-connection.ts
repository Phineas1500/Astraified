export type GeneratorStatus =
  "checking" | "online" | "locked" | "offline" | "unconfigured";

export class GeneratorApiError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "locked" | "request",
  ) {
    super(message);
    this.name = "GeneratorApiError";
  }
}

const offlineMessage =
  "The generator is unreachable. Your adventures are still available to play.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseGeneratorSession(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.authenticationRequired !== "boolean" ||
    typeof value.authenticated !== "boolean"
  )
    throw new GeneratorApiError(offlineMessage, "offline");
  return {
    authenticationRequired: value.authenticationRequired,
    authenticated: value.authenticated,
  };
}

export function parseGeneratorHealth(value: unknown) {
  if (
    !isRecord(value) ||
    value.ok !== true ||
    typeof value.configured !== "boolean"
  )
    throw new GeneratorApiError(offlineMessage, "offline");
  return { configured: value.configured };
}

// A tunnel or hosting proxy may return an HTML error page instead of API JSON.
// Never expose its markup or mistake it for a usable backend response.
export async function readGeneratorJson(
  response: Response,
): Promise<Record<string, unknown>> {
  if (response.status === 401)
    throw new GeneratorApiError(
      "Enter the access code to reconnect to the generator.",
      "locked",
    );
  if (response.status >= 500)
    throw new GeneratorApiError(offlineMessage, "offline");
  if (response.status === 204 && response.ok) return {};
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GeneratorApiError(offlineMessage, "offline");
  }
  if (!isRecord(data)) throw new GeneratorApiError(offlineMessage, "offline");
  if (!response.ok) {
    const error = data.error;
    const message =
      typeof error === "string"
        ? error
        : isRecord(error) && typeof error.message === "string"
          ? error.message
          : "The request could not be completed. Please try again.";
    throw new GeneratorApiError(message, "request");
  }
  return data;
}

export async function requestGeneratorJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    return await readGeneratorJson(response);
  } catch (error) {
    if (init.signal?.aborted || error instanceof GeneratorApiError) throw error;
    throw new GeneratorApiError(offlineMessage, "offline");
  }
}

export function generatorRetryDelay(failures: number): number {
  return Math.min(15_000, 1_800 * 2 ** Math.min(4, Math.max(0, failures - 1)));
}
