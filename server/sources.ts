import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { extname } from "node:path";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { preserveMathText } from "./math-text.js";
import { MAX_HTML_DOWNLOAD_BYTES, prepareSourceHtml } from "./html-source.js";
import type { SourceRecord } from "../src/domain/types.js";
import { SourceError } from "./errors.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_CHARS = 24_000;
const MAX_CHUNK_CHARS = 2_400;

/** Only globally routed unicast addresses may be fetched. DNS is pinned below. */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) === 6) {
    const first = Number.parseInt(address.split(":")[0] || "0", 16);
    // Exclude transition/tunnel ranges as well as local, mapped, multicast and reserved addresses.
    return (
      first >= 0x2000 &&
      first <= 0x3fff &&
      first !== 0x2001 &&
      first !== 0x2002 &&
      !address.toLowerCase().startsWith("3fff:")
    );
  }
  return false;
}

export function parseSourceUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SourceError(400, "Enter a complete public http or https URL.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (isIP(host) && !isPublicAddress(host))
  ) {
    throw new SourceError(
      400,
      "Source URLs must point to a public website on a standard web port.",
    );
  }
  url.hash = "";
  return url;
}

type Lookup = typeof lookup;
export async function resolveSourceUrl(raw: string, resolver: Lookup = lookup) {
  const url = parseSourceUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await resolver(hostname, { all: true, verbatim: true });
  } catch {
    throw new SourceError(422, "The source hostname could not be resolved.");
  }
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new SourceError(
      400,
      "Source URLs may not resolve to private or reserved networks.",
    );
  }
  return { url, address: addresses[0]! };
}

async function fetchOnce(
  raw: string,
  signal: AbortSignal,
): Promise<{
  status: number;
  location?: string;
  contentType: string;
  body: Buffer;
  url: string;
}> {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  const resolved = await Promise.race([
    resolveSourceUrl(raw),
    new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    }),
  ]).finally(() => {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  });
  const { url, address } = resolved;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        signal,
        headers: {
          "User-Agent": "Astraified-SourceReader/0.1",
          Accept: "text/html,application/pdf,text/plain,text/markdown",
          "Accept-Encoding": "identity",
        },
        // Pin the checked IP: no second DNS lookup can switch this request to a private address.
        lookup: (_hostname, options, callback) => {
          if (typeof options === "object" && options.all)
            callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        const contentType = String(
          response.headers["content-type"] || "",
        ).toLowerCase();
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          resolve({
            status,
            location: response.headers.location,
            contentType,
            body: Buffer.alloc(0),
            url: url.href,
          });
          return;
        }
        const mimeType = contentType.split(";", 1)[0].trim();
        const limit =
          mimeType === "application/pdf"
            ? MAX_UPLOAD_BYTES
            : mimeType === "text/html"
              ? MAX_HTML_DOWNLOAD_BYTES
              : 2 * 1024 * 1024;
        const tooLarge = () =>
          new SourceError(
            413,
            `This source exceeds the ${limit / (1024 * 1024)} MB download limit. Paste a focused excerpt or upload a smaller text document.`,
          );
        if (Number(response.headers["content-length"] || 0) > limit) {
          request.destroy(tooLarge());
          return;
        }
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        ) {
          request.destroy(
            new SourceError(
              422,
              "This website requires an unsupported compressed response. Upload its text or PDF instead.",
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) request.destroy(tooLarge());
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status,
            contentType,
            body: Buffer.concat(chunks),
            url: url.href,
          }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

export async function fetchPublicSource(raw: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(15_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let target = raw;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await fetchOnce(target, combined);
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (!result.location)
          throw new SourceError(
            422,
            "The source returned an invalid redirect.",
          );
        target = new URL(result.location, target).href;
        continue; // Each redirected hostname is separately validated and DNS-pinned.
      }
      if (result.status < 200 || result.status >= 300)
        throw new SourceError(
          422,
          `The source website returned HTTP ${result.status}. Upload its text or PDF instead.`,
        );
      return result;
    }
    throw new SourceError(
      422,
      "The source has too many redirects. Upload its text or PDF instead.",
    );
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if (combined.aborted)
      throw new SourceError(
        408,
        "Source retrieval timed out or was cancelled.",
      );
    throw new SourceError(
      422,
      "The source could not be downloaded. Upload its text or PDF instead.",
    );
  }
}

export function chunkSource(
  text: string,
  title: string,
  prefix: string,
  extra: Pick<SourceRecord, "url" | "page"> = {},
): SourceRecord[] {
  const clean = text
    .replace(/\u0000/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const chunks: SourceRecord[] = [];
  for (let offset = 0; offset < clean.length; offset += MAX_CHUNK_CHARS) {
    chunks.push({
      id: `${prefix}-${chunks.length + 1}`,
      title: `${title} · excerpt ${chunks.length + 1}`,
      text: clean.slice(offset, offset + MAX_CHUNK_CHARS),
      ...extra,
    });
  }
  return chunks;
}

export async function extractPdf(
  buffer: Buffer,
  title: string,
  url?: string,
): Promise<SourceRecord[]> {
  if (buffer.length > MAX_UPLOAD_BYTES)
    throw new SourceError(413, "PDF files must be smaller than 10 MB.");
  if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-")))
    throw new SourceError(422, "The file does not contain a readable PDF.");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    stopAtErrors: true,
  });
  const timer = setTimeout(() => {
    void task.destroy();
  }, 12_000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 60)
      throw new SourceError(413, "Choose a PDF excerpt of 60 pages or fewer.");
    const records: SourceRecord[] = [];
    let total = 0;
    for (
      let page = 1;
      page <= pdf.numPages && total < MAX_SOURCE_CHARS;
      page++
    ) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      const sliced = text.slice(0, MAX_SOURCE_CHARS - total);
      records.push(
        ...chunkSource(sliced, `${title} · page ${page}`, `pdf-p${page}`, {
          page,
          ...(url ? { url } : {}),
        }),
      );
      total += sliced.length;
    }
    return records;
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError(
      422,
      "The PDF could not be read. Use an unlocked text-based PDF; scanned pages need OCR first.",
    );
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}

export type SourceInput = {
  sourceText?: string;
  sourceUrl?: string;
  file?: { originalname: string; mimetype: string; buffer: Buffer };
};
export async function extractSources(input: SourceInput, signal?: AbortSignal) {
  let sources: SourceRecord[] = [];
  const warnings: string[] = [];
  if (input.sourceText?.trim()) {
    if (input.sourceText.length > MAX_SOURCE_CHARS)
      warnings.push("Pasted text was limited to the first 24,000 characters.");
    sources.push(
      ...chunkSource(
        input.sourceText.slice(0, MAX_SOURCE_CHARS),
        "Your pasted material",
        "text",
      ),
    );
  }
  if (input.file) {
    const { originalname, buffer } = input.file;
    const extension = extname(originalname).toLowerCase();
    const title = originalname.slice(0, 160);
    if (buffer.length > MAX_UPLOAD_BYTES)
      throw new SourceError(413, "Files must be smaller than 10 MB.");
    if (extension === ".pdf")
      sources.push(...(await extractPdf(buffer, title)));
    else if ([".txt", ".md", ".markdown"].includes(extension)) {
      let decoded: string;
      try {
        decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        throw new SourceError(
          422,
          "Save the text or Markdown file as UTF-8 and try again.",
        );
      }
      if (decoded.includes("\u0000"))
        throw new SourceError(
          422,
          "This looks like a binary file. Upload a text-based PDF, TXT, or Markdown document.",
        );
      if (decoded.length > MAX_SOURCE_CHARS)
        warnings.push(
          "The uploaded text was limited to its first 24,000 characters.",
        );
      sources.push(
        ...chunkSource(decoded.slice(0, MAX_SOURCE_CHARS), title, "file"),
      );
    } else
      throw new SourceError(
        415,
        "This demo reads PDF, TXT, and Markdown files.",
      );
    warnings.push(
      "Files are read as text. Embedded diagrams and scanned-page images are not interpreted yet.",
    );
  }
  if (input.sourceUrl?.trim()) {
    const fetched = await fetchPublicSource(input.sourceUrl.trim(), signal);
    if (
      fetched.contentType.includes("application/pdf") ||
      fetched.body.subarray(0, 5).toString() === "%PDF-"
    ) {
      // Separate IDs prevent collisions with an uploaded PDF.
      sources.push(
        ...(
          await extractPdf(
            fetched.body,
            new URL(fetched.url).hostname,
            fetched.url,
          )
        ).map((source) => ({ ...source, id: `web-${source.id}` })),
      );
    } else if (/text\/(html|plain|markdown)/.test(fetched.contentType)) {
      let text = fetched.body.toString("utf8");
      let title = new URL(fetched.url).hostname;
      if (fetched.contentType.includes("text/html")) {
        const dom = new JSDOM(prepareSourceHtml(text), { url: fetched.url });
        try {
          preserveMathText(dom.window.document);
          dom.window.document
            .querySelectorAll("script,style,nav,footer,header,noscript")
            .forEach((el) => el.remove());
          const article = new Readability(dom.window.document).parse();
          text =
            article?.textContent || dom.window.document.body?.textContent || "";
          title = article?.title || title;
        } finally {
          dom.window.close();
        }
        warnings.push(
          "Webpages are read as text. Embedded images and diagrams are not interpreted.",
        );
      }
      if (text.length > MAX_SOURCE_CHARS)
        warnings.push(
          "The webpage was limited to its first 24,000 extracted characters.",
        );
      sources.push(
        ...chunkSource(
          text.slice(0, MAX_SOURCE_CHARS),
          title.slice(0, 160),
          "web",
          { url: fetched.url },
        ),
      );
    } else
      throw new SourceError(
        415,
        "This URL is not a readable webpage, text file, or PDF.",
      );
  }
  let used = 0;
  const limited: SourceRecord[] = [];
  for (const source of sources) {
    if (used >= MAX_SOURCE_CHARS) {
      warnings.push(
        "Combined sources were limited to 24,000 characters. Use a focused excerpt for best results.",
      );
      break;
    }
    const text = source.text.slice(0, MAX_SOURCE_CHARS - used);
    if (text.trim()) limited.push({ ...source, text });
    used += text.length;
  }
  sources = limited;
  if (used < 120)
    throw new SourceError(
      422,
      "Add at least a short paragraph of source material about circuits or shortest paths. Topic-only research is not available in this first demo.",
      "source_required",
    );
  return { sources, warnings: [...new Set(warnings)] };
}
