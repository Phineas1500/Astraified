import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type express from "express";
import {
  EpisodeJobService,
  createEpisodeWriteGuard,
  episodeWriteGuard,
  type EpisodeJobOptions,
} from "../server/episode-jobs";
import { EpisodeGenerationError } from "../server/episode-generation";
import type {
  EpisodeLearningPlan,
  EpisodeProvider,
  EpisodeStory,
  GenerationResult,
} from "../server/episode-generation";
import type { EpisodePackage } from "../src/episodes/types";
import { SourceError } from "../server/errors";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const sourceText =
  "Token embeddings and positional encodings represent order. Attention uses scaled query-key dot products and softmax to combine values. Causal masking hides subsequent tokens from autoregressive self-attention.";
const sources = [
  { id: "source-1", title: "Uploaded source", text: sourceText },
];
const makePlan = (): EpisodeLearningPlan => ({
  supported: true,
  reason: "",
  objectives: (["positions", "attention", "causal"] as const).map(
    (family, i) => ({
      family,
      title: family,
      claim: "A supported principle.",
      boundaries: "Illustrative vectors only.",
      learnerAction: "Compare a controlled change.",
      misconception: "Mixing is not winner selection.",
      evidence: [{ sourceId: "source-1", quote: sourceText.split(". ")[i] }],
    }),
  ),
  notes: [],
});
const result = <T>(value: T): GenerationResult<T> => ({
  value,
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
});
const draft = { title: "A generated case" } as EpisodeStory;
const episode = {
  version: 1,
  id: "test-episode",
  title: "A verified episode",
} as EpisodePackage;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function provider(overrides: Partial<EpisodeProvider> = {}): EpisodeProvider {
  return {
    plan: vi.fn(async () => result(makePlan())),
    story: vi.fn(async () => result(draft)),
    repair: vi.fn(async () => result(draft)),
    ...overrides,
  };
}
async function setup(options: EpisodeJobOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), "astraified-jobs-test-"));
  directories.push(directory);
  const service = new EpisodeJobService({
    directory,
    provider: provider(),
    extract: vi.fn(async () => ({ sources, warnings: [] })),
    getApiKey: () => "test-key-not-a-real-credential",
    compile: vi.fn(() => episode),
    ...options,
  });
  await service.ready;
  return { service, directory };
}

describe("durable source-to-adventure jobs", () => {
  it("runs each stage once, preserves usage, and keeps uploads and API keys out of checkpoints", async () => {
    const fake = provider();
    const { service, directory } = await setup({ provider: fake });
    const created = await service.create({
      sourceText,
      file: {
        originalname: "private.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("raw upload marker"),
      },
    });
    await service.whenIdle();
    const ready = await service.get(created.id);
    expect(ready).toMatchObject({
      status: "ready",
      stage: "ready",
      progress: 100,
      episode,
      usage: { totalTokens: 60 },
      resumable: false,
    });
    expect(fake.plan).toHaveBeenCalledTimes(1);
    expect(fake.story).toHaveBeenCalledTimes(1);
    expect(fake.repair).not.toHaveBeenCalled();
    expect(fake.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        apparatus: expect.objectContaining({
          attention: expect.objectContaining({ dimensions: 2, tokenCount: 3 }),
        }),
      }),
    );
    expect(ready).not.toHaveProperty("sources");
    expect(ready).not.toHaveProperty("draft");
    const checkpoint = await readFile(
      join(directory, `${created.id}.json`),
      "utf8",
    );
    expect(checkpoint).toContain(sourceText);
    expect(checkpoint).not.toContain("test-key-not-a-real-credential");
    expect(checkpoint).not.toContain("raw upload marker");
    expect(
      (await stat(join(directory, `${created.id}.json`))).mode & 0o777,
    ).toBe(0o600);
  });
  it("rejects work without a configured key before extracting sources", async () => {
    const extract = vi.fn(async () => ({ sources, warnings: [] }));
    const { service } = await setup({ getApiKey: () => undefined, extract });
    await expect(service.create({ sourceText })).rejects.toMatchObject({
      code: "api_not_configured",
    });
    expect(extract).not.toHaveBeenCalled();
  });
  it("allows one active job and cancels it without discarding accepted source text", async () => {
    const called = deferred<void>();
    const { service } = await setup({
      provider: provider({
        plan: vi.fn(async () => {
          called.resolve();
          return new Promise<never>(() => {});
        }),
      }),
    });
    const first = await service.create({ sourceText });
    await called.promise;
    await expect(service.create({ sourceText })).rejects.toMatchObject({
      code: "generation_busy",
    });
    await service.cancel(first.id);
    await service.whenIdle();
    expect(await service.get(first.id)).toMatchObject({
      status: "cancelled",
      stage: "learning",
      resumable: true,
    });
  });
  it("resumes from a completed learning checkpoint without repeating its provider call", async () => {
    const storyCalled = deferred<void>();
    let calls = 0;
    const fake = provider({
      story: vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          storyCalled.resolve();
          return new Promise<never>(() => {});
        }
        return result(draft);
      }),
    });
    const { service } = await setup({ provider: fake });
    const job = await service.create({ sourceText });
    await storyCalled.promise;
    await service.cancel(job.id);
    await service.whenIdle();
    await service.resume(job.id);
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "ready",
      usage: { totalTokens: 60 },
    });
    expect(fake.plan).toHaveBeenCalledTimes(1);
    expect(fake.story).toHaveBeenCalledTimes(2);
  });
  it("marks a persisted running job interrupted after restart and waits for explicit resume", async () => {
    const storyCalled = deferred<void>();
    const { service, directory } = await setup({
      provider: provider({
        story: vi.fn(async () => {
          storyCalled.resolve();
          return new Promise<never>(() => {});
        }),
      }),
    });
    const job = await service.create({ sourceText });
    await storyCalled.promise;
    await service.cancel(job.id);
    await service.whenIdle();
    const path = join(directory, `${job.id}.json`);
    const saved = JSON.parse(await readFile(path, "utf8"));
    saved.status = "running";
    await writeFile(path, JSON.stringify(saved));
    const nextProvider = provider();
    const restarted = new EpisodeJobService({
      directory,
      provider: nextProvider,
      getApiKey: () => "test-key",
      compile: () => episode,
    });
    await restarted.ready;
    expect(await restarted.get(job.id)).toMatchObject({
      status: "interrupted",
      resumable: true,
      stage: "story",
    });
    expect(nextProvider.plan).not.toHaveBeenCalled();
    expect(nextProvider.story).not.toHaveBeenCalled();
    await restarted.resume(job.id);
    await restarted.whenIdle();
    expect((await restarted.get(job.id)).status).toBe("ready");
    expect(nextProvider.plan).not.toHaveBeenCalled();
    expect(nextProvider.story).toHaveBeenCalledTimes(1);
  });
  it("runs at most one repair and never labels an invalid package ready", async () => {
    const fake = provider();
    const compile = vi.fn(() => {
      throw new SourceError(
        502,
        "The reference route is invalid.",
        "invalid_episode",
      );
    });
    const { service } = await setup({ provider: fake, compile });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "failed",
      resumable: false,
      error: { code: "invalid_episode" },
      usage: { totalTokens: 90 },
    });
    expect(fake.repair).toHaveBeenCalledTimes(1);
    expect(compile).toHaveBeenCalledTimes(2);
    await expect(service.resume(job.id)).rejects.toMatchObject({
      code: "job_not_resumable",
    });
  });
  it("accepts a repaired package only after validating it again", async () => {
    const compile = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new SourceError(502, "Missing ending action", "invalid_episode");
      })
      .mockReturnValue(episode);
    const { service } = await setup({ compile });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "ready",
      episode,
      usage: { totalTokens: 90 },
    });
    expect(compile).toHaveBeenCalledTimes(2);
  });
  it("rejects unsupported or fabricated source evidence before story generation", async () => {
    const invalid = makePlan();
    invalid.objectives[2].evidence[0].quote =
      "An invented quotation with no support whatsoever.";
    const fake = provider({ plan: vi.fn(async () => result(invalid)) });
    const { service } = await setup({ provider: fake });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "failed",
      error: { code: "invalid_learning_evidence" },
      resumable: false,
      usage: { totalTokens: 30 },
    });
    expect(fake.story).not.toHaveBeenCalled();
  });
  it("times out a hung stage and bounds explicit retries", async () => {
    const fake = provider({
      plan: vi.fn(async () => new Promise<never>(() => {})),
    });
    const { service } = await setup({ provider: fake, stageTimeoutMs: 15 });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "failed",
      error: { code: "generation_timeout" },
      resumable: true,
    });
    for (let i = 0; i < 2; i++) {
      await service.resume(job.id);
      await service.whenIdle();
    }
    expect((await service.get(job.id)).resumable).toBe(false);
    expect(fake.plan).toHaveBeenCalledTimes(3);
  });
  it("gives story and repair a longer bounded SDK deadline than learning", async () => {
    const fake = provider();
    const compile = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new SourceError(502, "Repair the ending.", "invalid_episode");
      })
      .mockReturnValue(episode);
    const { service } = await setup({ provider: fake, compile });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect((await service.get(job.id)).status).toBe("ready");
    expect(fake.plan).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 155_000 }),
    );
    expect(fake.story).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 420_000 }),
    );
    expect(fake.repair).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 420_000 }),
    );
  });
  it("does not apply the learning deadline to a longer story stage", async () => {
    const fake = provider({
      story: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return result(draft);
      }),
    });
    const { service } = await setup({
      provider: fake,
      learningTimeoutMs: 15,
      storyTimeoutMs: 180,
    });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect((await service.get(job.id)).status).toBe("ready");
  });
  it("preserves returned incomplete-response usage exactly once across an explicit resume", async () => {
    let storyCalls = 0;
    const fake = provider({
      story: vi.fn(async () => {
        storyCalls += 1;
        if (storyCalls === 1)
          throw new EpisodeGenerationError(
            502,
            "The stage reached its output budget.",
            "incomplete_generation",
            { inputTokens: 5, outputTokens: 40, totalTokens: 45 },
          );
        return result(draft);
      }),
    });
    const { service, directory } = await setup({ provider: fake });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "failed",
      resumable: true,
      usage: { totalTokens: 75 },
      error: { code: "incomplete_generation" },
    });
    const stored = JSON.parse(
      await readFile(join(directory, `${job.id}.json`), "utf8"),
    );
    expect(stored.usage.totalTokens).toBe(75);
    expect(stored.draft).toBeUndefined();
    await service.resume(job.id);
    await service.whenIdle();
    expect(await service.get(job.id)).toMatchObject({
      status: "ready",
      usage: { totalTokens: 105 },
    });
    expect(fake.plan).toHaveBeenCalledTimes(1);
  });
  it("allows the third explicit story attempt after two incomplete responses", async () => {
    const fake = provider({
      story: vi.fn(async () => {
        throw new EpisodeGenerationError(
          502,
          "Incomplete story",
          "incomplete_generation",
        );
      }),
    });
    const { service } = await setup({ provider: fake });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    await service.resume(job.id);
    await service.whenIdle();
    expect((await service.get(job.id)).resumable).toBe(true);
    await service.resume(job.id);
    await service.whenIdle();
    expect((await service.get(job.id)).resumable).toBe(false);
    expect(fake.story).toHaveBeenCalledTimes(3);
    expect(fake.plan).toHaveBeenCalledTimes(1);
  });
  it("sanitizes unexpected provider errors rather than returning raw exception text", async () => {
    const { service } = await setup({
      provider: provider({
        plan: vi.fn(async () => {
          throw new Error("sensitive raw provider response");
        }),
      }),
    });
    const job = await service.create({ sourceText });
    await service.whenIdle();
    expect(JSON.stringify(await service.get(job.id))).not.toContain(
      "sensitive raw provider response",
    );
  });
  it("aborts source extraction on client cancellation before accepting or charging a job", async () => {
    const extractionStarted = deferred<void>();
    const fake = provider();
    const extract: NonNullable<EpisodeJobOptions["extract"]> = async (
      _input,
      signal,
    ) => {
      extractionStarted.resolve();
      await new Promise<void>((_resolve, reject) =>
        signal!.addEventListener(
          "abort",
          () => reject(new Error("cancelled")),
          { once: true },
        ),
      );
      return { sources, warnings: [] };
    };
    const { service } = await setup({ provider: fake, extract });
    const controller = new AbortController();
    const creating = service.create({ sourceText }, controller.signal);
    await extractionStarted.promise;
    controller.abort();
    await expect(creating).rejects.toThrow("cancelled");
    expect(fake.plan).not.toHaveBeenCalled();
  });
  it("rejects invalid job identifiers without using them as filesystem paths", async () => {
    const { service } = await setup();
    await expect(service.get("../../private")).rejects.toMatchObject({
      code: "job_not_found",
    });
    await expect(service.cancel("unknown")).rejects.toMatchObject({
      code: "job_not_found",
    });
  });
});

describe("generation mutation origin checks", () => {
  function guard(
    headers: Record<string, string | undefined>,
    middleware = episodeWriteGuard,
  ) {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    middleware(
      { headers } as express.Request,
      response as unknown as express.Response,
      next,
    );
    return { response, next };
  }
  it("allows same-origin localhost and local CLI requests", () => {
    expect(
      guard({ host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173" }).next,
    ).toHaveBeenCalledOnce();
    expect(guard({ host: "localhost:8787" }).next).toHaveBeenCalledOnce();
  });
  it("accepts the exact frontend origins through Vite's rewritten API Host", () => {
    for (const origin of ["http://127.0.0.1:5173", "http://localhost:5173"]) {
      expect(
        guard({ host: "127.0.0.1:8787", origin }).next,
      ).toHaveBeenCalledOnce();
    }
  });
  it("accepts an explicitly configured local frontend without opening arbitrary ports", () => {
    const configured = createEpisodeWriteGuard(["http://127.0.0.1:4173"]);
    expect(
      guard(
        { host: "127.0.0.1:8787", origin: "http://127.0.0.1:4173" },
        configured,
      ).next,
    ).toHaveBeenCalledOnce();
    expect(
      guard(
        { host: "127.0.0.1:8787", origin: "http://127.0.0.1:5173" },
        configured,
      ).response.status,
    ).toHaveBeenCalledWith(403);
  });
  it("rejects remote, mismatched local-port, and cross-site mutations", () => {
    for (const headers of [
      { host: "127.0.0.1:5173", origin: "https://example.com" },
      { host: "127.0.0.1:5173", origin: "http://127.0.0.1:9999" },
      { host: "127.0.0.1:8787", origin: "http://localhost.evil.example:5173" },
      { host: "127.0.0.1:8787", origin: "http://localhost:5173/path" },
      { host: "127.0.0.1:8787", origin: "http://attacker@localhost:5173" },
      { host: "127.0.0.1:8787", origin: "null" },
      { host: "127.0.0.1:5173", "sec-fetch-site": "cross-site" },
    ]) {
      const result = guard(headers);
      expect(result.response.status).toHaveBeenCalledWith(403);
      expect(result.next).not.toHaveBeenCalled();
    }
  });
});
