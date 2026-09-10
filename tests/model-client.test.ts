import { afterEach, describe, expect, it } from "vitest";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Agent } from "undici";
import OpenAI from "openai";
import { createModelClient } from "../server/model-client";

const servers: Server[] = [];
const transports: ReturnType<typeof createModelClient>[] = [];
afterEach(async () => {
  await Promise.all(transports.splice(0).map((transport) => transport.destroy()));
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  })));
});
async function localEndpoint(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
}
function client(baseURL: string, timeoutMs = 2000) {
  const transport = createModelClient({ apiKey: "local-transport-test-key", baseURL, timeoutMs });
  transports.push(transport);
  return transport;
}

describe("model request transport deadlines and cleanup", () => {
  it("completes a real local SDK request and destroys its owned connection pool once", async () => {
    let requests = 0;
    const endpoint = await localEndpoint((request, response) => {
      requests += 1;
      expect(request.url).toBe("/v1/models");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "list", data: [{ id: "local-test", object: "model", created: 0, owned_by: "test" }] }));
    });
    const transport = client(endpoint);
    const response = await transport.client.models.list();
    expect(response.data[0].id).toBe("local-test");
    expect(requests).toBe(1);
    expect(transport.client.maxRetries).toBe(0);
    const first = transport.destroy();
    expect(transport.destroy()).toBe(first);
    await first;
    expect((transport.client.fetchOptions?.dispatcher as Agent).destroyed).toBe(true);
  });
  it("uses the configured transport header deadline even when an SDK request allows longer", async () => {
    let requests = 0;
    const endpoint = await localEndpoint((_request, _response) => { requests += 1; /* Intentionally withhold response headers. */ });
    const transport = client(endpoint, 30);
    const started = Date.now();
    const error = await transport.client.models.list({ timeout: 5000 }).then(() => undefined, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(OpenAI.APIConnectionTimeoutError);
    // This identifies Undici's independent HTTP timeout, not the longer SDK timer.
    expect(error).toMatchObject({ cause: { cause: { code: "UND_ERR_HEADERS_TIMEOUT" } } });
    expect(Date.now() - started).toBeLessThan(4000);
    expect(requests).toBe(1);
    await transport.destroy();
  }, 6000);
  it("honors explicit cancellation and cleans up the pending HTTP connection", async () => {
    let entered!: () => void;
    const requestStarted = new Promise<void>((resolve) => { entered = resolve; });
    const endpoint = await localEndpoint(() => entered());
    const transport = client(endpoint);
    const controller = new AbortController();
    const failure = transport.client.models.list({ signal: controller.signal }).then(() => undefined, (error: unknown) => error);
    await requestStarted;
    controller.abort();
    expect(await failure).toBeInstanceOf(OpenAI.APIUserAbortError);
    await transport.destroy();
    expect((transport.client.fetchOptions?.dispatcher as Agent).destroyed).toBe(true);
  });
  it("does not automatically repeat a failed model request", async () => {
    let requests = 0;
    const endpoint = await localEndpoint((_request, response) => {
      requests += 1;
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Intentional local failure" } }));
    });
    const transport = client(endpoint);
    await expect(transport.client.models.list()).rejects.toMatchObject({ status: 500 });
    expect(requests).toBe(1);
  });
  it("rejects missing or invalid timeout budgets before allocating transport", () => {
    for (const timeoutMs of [0, -1, NaN, Infinity, 1.5])
      expect(() => createModelClient({ apiKey: "local-transport-test-key", timeoutMs })).toThrow("positive integer timeout");
  });
});
