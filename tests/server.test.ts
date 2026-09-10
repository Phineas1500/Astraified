import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { lookup } from "node:dns/promises";
import {
  chunkSource,
  extractPdf,
  extractSources,
  isPublicAddress,
  parseSourceUrl,
  resolveSourceUrl,
} from "../server/sources";
import {
  GenerationSchema,
  validateGeneratedMission,
} from "../server/generation";
import { createApp } from "../server/index";
import type { SourceRecord } from "../src/domain/types";

const text =
  "A complete closed conducting loop permits electric current. Series circuits share a single current path through their lamps. Parallel circuits have independent branches across the same fixed voltage source. Each edge in a weighted graph has a cost. A path cost is the sum of its edge weights, and a shortest path minimizes this total.";
const sources: SourceRecord[] = [
  { id: "source-1", title: "Test source", text },
];

function validDraft(domain: "circuits" | "routing" = "circuits") {
  return {
    domain,
    reason: "",
    evidence: ["workshop", "relay", "beacon"].map((stationId) => ({
      stationId,
      sourceId: "source-1",
      quote:
        domain === "circuits"
          ? text.slice(0, 60)
          : "A path cost is the sum of its edge weights",
    })),
    mission: {
      title: "A harbor mission",
      subtitle: "Restore the signal",
      topic: domain,
      description: "An educational mission.",
      briefing: "Restore three harbor systems.",
      estimatedMinutes: 10,
      objectives: ["one", "two", "three"].map((id) => ({
        id,
        title: "Understand a concept",
        sourceIds: ["source-1"],
      })),
      stations: ["workshop", "relay", "beacon"].map((id, index) => ({
        id,
        name: id,
        title: "Restore a system",
        story: "The harbor keeper needs your help.",
        task: "Find a working configuration.",
        concept: "A source-backed concept.",
        sourceIds: ["source-1"],
        hints: ["Try a small experiment.", "Watch the result."],
        kind: domain === "circuits" ? "circuit" : "routing",
        circuit:
          domain === "circuits"
            ? {
                goal: ["closed", "series", "parallel"][index],
                voltage: 12,
                resistance: 6,
              }
            : null,
        routing:
          domain === "routing"
            ? {
                nodes: ["A", "B", "C"],
                edges: [
                  { from: "A", to: "B", weight: 1 },
                  { from: "B", to: "C", weight: 1 },
                  { from: "A", to: "C", weight: 7 },
                ],
                start: "A",
                end: "C",
              }
            : null,
      })),
      conclusion: "The harbor is restored.",
    },
  };
}

describe("public source guards", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.5.4",
    "192.168.1.1",
    "100.64.0.1",
    "198.18.0.1",
    "192.0.2.1",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2002:7f00:1::1",
  ])("rejects nonpublic address %s", (address) =>
    expect(isPublicAddress(address)).toBe(false),
  );
  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "permits global address %s",
    (address) => expect(isPublicAddress(address)).toBe(true),
  );
  it.each([
    "file:///etc/passwd",
    "http://localhost/a",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://[::1]/",
    "https://user:password@example.com",
    "http://example.com:8787",
  ])("rejects unsafe URL %s", (url) =>
    expect(() => parseSourceUrl(url)).toThrow(),
  );
  it("rejects DNS results containing even one private address", async () => {
    const resolver = (async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]) as unknown as typeof lookup;
    await expect(
      resolveSourceUrl("https://example.com", resolver),
    ).rejects.toThrow("private or reserved");
  });
  it("returns the validated pinned DNS address", async () => {
    const resolver = (async () => [
      { address: "8.8.8.8", family: 4 },
    ]) as unknown as typeof lookup;
    const result = await resolveSourceUrl(
      "https://example.com/lesson#section",
      resolver,
    );
    expect(result.address.address).toBe("8.8.8.8");
    expect(result.url.href).toBe("https://example.com/lesson");
  });
});

describe("source extraction", () => {
  it("preserves page and URL provenance in exact excerpt chunks", () => {
    const long = "A".repeat(2500);
    const result = chunkSource(long, "Chapter", "pdf-p3", {
      page: 3,
      url: "https://example.com/book.pdf",
    });
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.text).join("")).toBe(long);
    expect(result[1]).toMatchObject({
      id: "pdf-p3-2",
      page: 3,
      url: "https://example.com/book.pdf",
    });
  });
  it("rejects source-free topic generation and unreadable files without an API call", async () => {
    await expect(extractSources({})).rejects.toMatchObject({
      status: 422,
      code: "source_required",
    });
    await expect(
      extractPdf(Buffer.from("This is not a PDF"), "wrong.pdf"),
    ).rejects.toThrow("readable PDF");
    await expect(
      extractSources({
        file: {
          originalname: "deck.pptx",
          mimetype: "application/octet-stream",
          buffer: Buffer.from(text),
        },
      }),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("caps total source context and reports truncation", async () => {
    const result = await extractSources({ sourceText: text.repeat(100) });
    expect(
      result.sources.reduce((sum, source) => sum + source.text.length, 0),
    ).toBeLessThanOrEqual(24_000);
    expect(result.warnings[0]).toMatch(/24,000/);
  });
  it("reads an actual PDF page with its page provenance", async () => {
    const content = `BT /F1 12 Tf 30 700 Td (${text}) Tj ET`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join(
        "",
      )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const result = await extractPdf(Buffer.from(pdf), "lesson.pdf");
    expect(result[0]).toMatchObject({ page: 1, id: "pdf-p1-1" });
    expect(result[0].text).toContain("complete closed conducting loop");
  });
});

describe("generation validation", () => {
  it("adds only server-owned provenance and deterministic assessments", () => {
    const mission = validateGeneratedMission(
      validDraft(),
      sources,
      "High school",
    );
    expect(mission.stations.map((station) => station.circuit?.goal)).toEqual([
      "closed",
      "series",
      "parallel",
    ]);
    expect(mission.sources).toEqual(sources);
    expect(mission.generated).toBe(true);
    expect(mission.generation?.model).toBe("gpt-6-astra");
    expect(
      mission.stations[2].check.options[mission.stations[2].check.answer],
    ).toMatch(/same brightness/);
  });
  it("rejects invented quotations and unknown source IDs", () => {
    const draft = validDraft();
    draft.evidence[0].quote =
      "Invented scientific evidence that is not in the source";
    expect(() => validateGeneratedMission(draft, sources, "College")).toThrow(
      "quotation",
    );
    const unknown = validDraft();
    unknown.mission.stations[1].sourceIds = ["fake-source"];
    expect(() => validateGeneratedMission(unknown, sources, "College")).toThrow(
      "unknown source",
    );
  });
  it("rejects domain mismatch, wrong station sequence, and invalid numeric parameters", () => {
    const mismatch = validDraft();
    mismatch.domain = "routing";
    expect(() =>
      validateGeneratedMission(mismatch, sources, "College"),
    ).toThrow("mechanic");
    const order = validDraft();
    order.mission.stations.reverse();
    expect(() => validateGeneratedMission(order, sources, "College")).toThrow(
      "in order",
    );
    const invalid = validDraft();
    invalid.mission.stations[0].circuit!.resistance = 0;
    expect(() => validateGeneratedMission(invalid, sources, "College")).toThrow(
      "package checks",
    );
  });
  it("returns an honest unsupported-topic result", () => {
    expect(() =>
      validateGeneratedMission(
        {
          domain: "unsupported",
          reason:
            "This chemistry chapter cannot yet become a supported circuit or routing game.",
          evidence: [],
          mission: null,
        },
        sources,
        "College",
      ),
    ).toThrow("chemistry");
  });
  it("requires evidence for every station", () => {
    const draft = validDraft();
    draft.evidence.pop();
    expect(() => validateGeneratedMission(draft, sources, "College")).toThrow(
      "each station",
    );
  });
  it("uses distinct routing transfer checks for addition, whole-route comparison, and scaling", () => {
    const mission = validateGeneratedMission(
      validDraft("routing"),
      sources,
      "College",
    );
    const checks = mission.stations.map((station) => station.check);
    expect(new Set(checks.map((check) => check.question)).size).toBe(3);
    expect(checks.map((check) => check.options[check.answer])).toEqual([
      "9 minutes",
      "Start → Bridge → Finish",
      "4",
    ]);
    expect(checks[1].explanation).toContain("4 + 2 = 6");
    expect(checks[1].explanation).toContain("1 + 9 = 10");
  });
  it("derives the scaling check from the actual weighted shortest route while earlier checks use new maps", () => {
    const original = validateGeneratedMission(
      validDraft("routing"),
      sources,
      "College",
    );
    const changed = validDraft("routing");
    for (const station of changed.mission.stations)
      station.routing!.edges[1].weight = 11;
    const mission = validateGeneratedMission(changed, sources, "College");
    expect(mission.stations[0].check).toEqual(original.stations[0].check);
    expect(mission.stations[1].check).toEqual(original.stations[1].check);
    const check = mission.stations[2].check;
    expect(check.options[check.answer]).toBe("14");
  });
  it("rejects disconnected graphs and duplicate undirected edges", () => {
    const disconnected = validDraft("routing");
    disconnected.mission.stations[0].routing!.nodes.push("D");
    expect(() =>
      validateGeneratedMission(disconnected, sources, "College"),
    ).toThrow("every graph node");
    const duplicate = validDraft("routing");
    duplicate.mission.stations[0].routing!.edges.push({
      from: "B",
      to: "A",
      weight: 4,
    });
    expect(() =>
      validateGeneratedMission(duplicate, sources, "College"),
    ).toThrow("edges must be distinct");
  });
  it("does not permit provider-controlled source URLs or arbitrary extra keys", () => {
    expect(
      GenerationSchema.safeParse({
        ...validDraft(),
        sources: [{ url: "https://invented.invalid" }],
      }).success,
    ).toBe(false);
  });
});

describe("local API boundaries (no paid calls)", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = await new Promise<Server>((resolve, reject) => {
      const running = createApp({ episodeJobs: false }).listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve(running),
      );
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    if (server?.listening)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
  });
  it("reports configuration without exposing key material", async () => {
    const response = await fetch(`${base}/api/health`);
    const health = await response.json();
    expect(Object.keys(health).sort()).toEqual(["configured", "model", "ok"]);
    expect(health).toMatchObject({ ok: true, model: "gpt-6-astra" });
  });
  it("blocks cross-origin credit-bearing requests before upload or generation", async () => {
    const response = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("invalid_origin");
  });
});
