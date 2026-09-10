import OpenAI, { type ClientOptions } from "openai";
import { Agent, fetch } from "undici";

/**
 * Pair Undici's fetch and dispatcher so Node's independent five-minute HTTP
 * timeout cannot silently shorten a longer model-generation stage.
 * The caller still supplies its stage AbortSignal to each SDK request and must
 * destroy this per-call transport in finally, including on cancellation.
 */
export function createModelClient(options: {
  apiKey: string;
  timeoutMs: number;
  /** Useful for a configured compatible endpoint and isolated local tests. */
  baseURL?: string;
}): { client: OpenAI; destroy: () => Promise<void> } {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)
    throw new RangeError("A model request needs a positive integer timeout.");
  const dispatcher = new Agent({
    headersTimeout: options.timeoutMs,
    bodyTimeout: options.timeoutMs,
  });
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    timeout: options.timeoutMs,
    maxRetries: 0,
    // Undici and DOM declare different Request extras; the SDK invokes fetch
    // with URL strings. Keep its runtime implementation paired with this Agent.
    fetch: fetch as unknown as ClientOptions["fetch"],
    fetchOptions: { dispatcher },
  });
  let destruction: Promise<void> | undefined;
  return {
    client,
    // Abrupt cleanup also closes outstanding requests; graceful close could
    // wait indefinitely after a cancelled or timed-out stage.
    destroy: () => (destruction ??= dispatcher.destroy()),
  };
}
