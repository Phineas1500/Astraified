import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { PassThrough } from "node:stream";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_HTML_DOWNLOAD_BYTES,
  MAX_HTML_MARKUP_BYTES,
  prepareSourceHtml,
} from "../server/html-source";
import { preserveMathText } from "../server/math-text";
import {
  extractSources,
  fetchPublicSource,
  MAX_UPLOAD_BYTES,
} from "../server/sources";

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: dns.lookup }));

type Reply = {
  status?: number;
  headers?: http.IncomingHttpHeaders;
  chunks?: Buffer[];
  holdOpen?: boolean;
  onHeaders?: () => void;
};
type CapturedRequest = {
  url: URL;
  options: http.RequestOptions;
  request: http.ClientRequest;
};
let replies: Reply[];
let requests: CapturedRequest[];

// Only the transport and public DNS result are mocked. The real fetch guard,
// byte accounting, HTML preparation, Readability and source chunking all run.
beforeEach(() => {
  replies = [];
  requests = [];
  dns.lookup.mockReset();
  dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  const request = (
    url: URL,
    options: http.RequestOptions,
    receive: (response: http.IncomingMessage) => void,
  ) => {
    const emitter = new EventEmitter();
    let destroyed = false;
    let response: PassThrough | undefined;
    const signal = options.signal;
    const onAbort = () => client.destroy(signal?.reason);
    const client = Object.assign(emitter, {
      get destroyed() {
        return destroyed;
      },
      destroy(error?: Error) {
        if (destroyed) return client;
        destroyed = true;
        signal?.removeEventListener("abort", onAbort);
        response?.destroy();
        if (error) queueMicrotask(() => emitter.emit("error", error));
        return client;
      },
      end() {
        queueMicrotask(() => {
          if (destroyed) return;
          const reply = replies.shift();
          if (!reply) {
            client.destroy(new Error("Unexpected request in source test"));
            return;
          }
          response = new PassThrough();
          const incoming = Object.assign(response, {
            statusCode: reply.status ?? 200,
            headers: reply.headers ?? { "content-type": "text/html" },
          }) as unknown as http.IncomingMessage;
          receive(incoming);
          reply.onHeaders?.();
          if (destroyed || reply.holdOpen) return;
          for (const chunk of reply.chunks ?? []) {
            if (destroyed) break;
            response.write(chunk);
          }
          if (!destroyed) response.end();
          signal?.removeEventListener("abort", onAbort);
        });
        return client;
      },
    }) as unknown as http.ClientRequest;
    signal?.addEventListener("abort", onAbort, { once: true });
    requests.push({ url, options, request: client });
    return client;
  };
  vi.spyOn(https, "request").mockImplementation(
    request as typeof https.request,
  );
  vi.spyOn(http, "request").mockImplementation(request as typeof http.request);
});

afterEach(() => {
  for (const { request } of requests) request.destroy();
  vi.restoreAllMocks();
});

const lecture =
  "Attention computes a weighted mixture of value vectors. Queries and keys determine the weights, while the value vectors provide the quantities that are combined. Changing a value alone can change the output while keeping the attention weights fixed.";
const asset = "data:image/png;base64," + "A".repeat(3 * 1024 * 1024);
const sourceUrl = "https://lectures.example.edu/attention.html";

function readableText(html: string) {
  const dom = new JSDOM(html);
  try {
    preserveMathText(dom.window.document);
    return dom.window.document.body.textContent ?? "";
  } finally {
    dom.window.close();
  }
}

describe("bounded public source downloads", () => {
  it("extracts an asset-heavy lecture through the actual source pipeline", async () => {
    const html = `<html><head><title>Attention lecture</title><style>${".unused{}".repeat(30_000)}</style></head><body><article><h1>Attention lecture</h1><p>${lecture}</p><img src="${asset}" alt="Illustrative diagram"><p>A normalized mixture is <math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>, with both contributions accounted for.</p><script>throw new Error("must never run")</script><img src="http://127.0.0.1/private.png"></article></body></html>`;
    const body = Buffer.from(html);
    expect(body.length).toBeGreaterThan(2 * 1024 * 1024);
    replies.push({
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(body.length),
      },
      chunks: [body.subarray(0, 8191), body.subarray(8191)],
    });
    const result = await extractSources({ sourceUrl });
    const extracted = result.sources.map((source) => source.text).join("");
    expect(extracted).toContain(lecture);
    expect(extracted).toContain("(a)/(b)");
    expect(extracted).toContain("both contributions accounted for");
    expect(extracted).not.toMatch(/data:image|\.unused|must never run/);
    expect(result.sources[0]).toMatchObject({ url: sourceUrl });
    expect(result.sources[0].title).toContain("Attention lecture");
    expect(requests).toHaveLength(1);
    expect(dns.lookup).toHaveBeenCalledTimes(1);
    const pinned = vi.fn();
    requests[0].options.lookup!("lectures.example.edu", {}, pinned);
    expect(pinned).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    expect(requests[0].options.headers).toMatchObject({
      "Accept-Encoding": "identity",
    });
  });

  it("rejects a declared oversized HTML body before receiving its bytes", async () => {
    replies.push({
      headers: {
        "content-type": "text/html",
        "content-length": String(MAX_HTML_DOWNLOAD_BYTES + 1),
      },
    });
    await expect(fetchPublicSource(sourceUrl)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("rejects chunked HTML as soon as its actual byte budget is exceeded", async () => {
    replies.push({
      headers: { "content-type": "text/html" },
      chunks: [Buffer.alloc(MAX_HTML_DOWNLOAD_BYTES), Buffer.from("x")],
    });
    await expect(fetchPublicSource(sourceUrl)).rejects.toMatchObject({
      status: 413,
    });
  });

  it.each(["text/plain", "text/markdown"])(
    "keeps the 2 MiB streamed limit for %s",
    async (contentType) => {
      replies.push({
        headers: { "content-type": contentType },
        chunks: [Buffer.alloc(2 * 1024 * 1024), Buffer.from("x")],
      });
      await expect(fetchPublicSource(sourceUrl)).rejects.toMatchObject({
        status: 413,
      });
    },
  );

  it("retains the 10 MiB PDF transport limit", async () => {
    replies.push({
      headers: { "content-type": "application/pdf" },
      chunks: [Buffer.alloc(MAX_UPLOAD_BYTES)],
    });
    expect((await fetchPublicSource(sourceUrl)).body.length).toBe(
      MAX_UPLOAD_BYTES,
    );
    replies.push({
      headers: {
        "content-type": "application/pdf",
        "content-length": String(MAX_UPLOAD_BYTES + 1),
      },
    });
    await expect(fetchPublicSource(sourceUrl)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("still rejects compressed responses instead of bypassing the byte cap", async () => {
    replies.push({
      headers: {
        "content-type": "text/html",
        "content-encoding": "gzip",
      },
    });
    await expect(fetchPublicSource(sourceUrl)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("cancels an in-progress response through the caller's abort signal", async () => {
    let opened!: () => void;
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    replies.push({ holdOpen: true, onHeaders: opened });
    const controller = new AbortController();
    const result = fetchPublicSource(sourceUrl, controller.signal).catch(
      (error: unknown) => error,
    );
    await started;
    controller.abort();
    expect(await result).toMatchObject({ status: 408 });
  });

  it("rechecks redirect DNS and never requests the private destination", async () => {
    dns.lookup
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    replies.push({
      status: 302,
      headers: { location: "https://internal.example.edu/secret" },
    });
    await expect(fetchPublicSource(sourceUrl)).rejects.toMatchObject({
      status: 400,
    });
    expect(requests).toHaveLength(1);
    expect(dns.lookup).toHaveBeenCalledTimes(2);
  });

  it("keeps the 24,000-character extracted source budget and warning", async () => {
    replies.push({
      chunks: [Buffer.from(`<article><p>${lecture.repeat(150)}</p></article>`)],
    });
    const result = await extractSources({ sourceUrl });
    const extractedLength = result.sources.reduce(
      (n, source) => n + source.text.length,
      0,
    );
    expect(extractedLength).toBeLessThanOrEqual(24_000);
    expect(extractedLength).toBeGreaterThan(23_000);
    expect(result.warnings.some((warning) => warning.includes("24,000"))).toBe(
      true,
    );
  });
});

describe("HTML preparation before DOM extraction", () => {
  it("removes mixed-case quoted and unquoted assets without consuming prose", () => {
    const html = `<article><p>Before the diagram: 3 &gt; 2.</p><img alt='a > b' src='DATA:image/png;base64,AAAA'><img src=data:image/png;base64,BBBB><p>After the diagram, café remains readable.</p><style>p{background:url(data:image/png;base64,CCCC)}</style><script>untrustedContent()</script><p>A literal data:image example in prose is still source text.</p></article>`;
    const prepared = prepareSourceHtml(html);
    const text = readableText(prepared);
    expect(prepared).not.toMatch(/AAAA|BBBB|CCCC|untrustedContent/);
    expect(text).toContain("Before the diagram: 3 > 2.");
    expect(text).toContain("After the diagram, café remains readable.");
    expect(text).toContain("A literal data:image example in prose");
  });

  it("preserves MathML grouping and original TeX annotations in recovered HTML", () => {
    const prepared = prepareSourceHtml(
      '<article><p>Before <math><mfrac><mi>a</mi><mi>b</mi></mfrac></math><p>Then <math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^{2}+1</annotation></semantics></math><p>After the equation.',
    );
    const text = readableText(prepared);
    expect(text).toContain("(a)/(b)");
    expect(text).toContain("x^{2}+1");
    expect(text).toContain("After the equation.");
  });

  it("retains a small DOM budget even when the download cap is larger", () => {
    expect(MAX_HTML_DOWNLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_HTML_MARKUP_BYTES).toBe(2 * 1024 * 1024);
    const prepared = prepareSourceHtml(
      `<article><p>${lecture}</p><img src="${asset}"><p>Final prose.</p></article>`,
    );
    expect(Buffer.byteLength(prepared)).toBeLessThan(4096);
    expect(readableText(prepared)).toContain("Final prose.");
    expect(() =>
      prepareSourceHtml(`<p>${"x".repeat(MAX_HTML_MARKUP_BYTES + 1)}</p>`),
    ).toThrow();
  });

  it("bounds element counts even when markup fits the byte budget", () => {
    const html = "<i>x</i>".repeat(20_001);
    expect(Buffer.byteLength(html)).toBeLessThan(MAX_HTML_MARKUP_BYTES);
    expect(() => prepareSourceHtml(html)).toThrow();
  });

  it("rejects excessive nesting before the retained tree is serialized", () => {
    const html = "<div>".repeat(300) + "Source text" + "</div>".repeat(300);
    expect(() => prepareSourceHtml(html)).toThrow(/deeply nested/);
  });
});
