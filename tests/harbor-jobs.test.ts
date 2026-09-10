import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  EpisodeJobService,
  type EpisodeJobOptions,
} from "../server/episode-jobs";
import type { HarborProvider } from "../server/harbor-generation";
import type { GeneralProvider } from "../server/general-generation";
import { validateGamePackage } from "../src/games/schema";
import type { GenerationResult } from "../server/episode-generation";
import { SourceError } from "../server/errors";
import {
  harborSources,
  harborPlan,
  harborMechanics,
  harborStory,
  harborEvidenceSources,
  harborEvidencePlan,
  harborEvidenceMechanics,
} from "./fixtures/harbor-episode";
import {
  calculusSources,
  calculusPlan,
  calculusMechanics,
  generalStory,
} from "./fixtures/general-episode";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const result = <T>(value: T): GenerationResult<T> => ({
  value,
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
});
const approved = () => ({
  passed: true,
  summary:
    "The model review found the focused source claims and illustrative machine consistent.",
  issues: [],
});
function provider(overrides: Partial<HarborProvider> = {}): HarborProvider {
  return {
    plan: vi.fn(async () => result(harborPlan())),
    mechanics: vi.fn(async () => result(harborMechanics())),
    story: vi.fn(async () => result(harborStory())),
    review: vi.fn(async () => result(approved())),
    repairMechanics: vi.fn(async () => result(harborMechanics())),
    repairBundle: vi.fn(async () =>
      result({ mechanics: harborMechanics(), story: harborStory() }),
    ),
    ...overrides,
  };
}
async function setup(options: EpisodeJobOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), "astraified-harbor-jobs-"));
  directories.push(directory);
  const service = new EpisodeJobService({
    directory,
    harborProvider: provider(),
    extract: vi.fn(async () => ({ sources: harborSources, warnings: [] })),
    getApiKey: () => "test-private-api-key",
    ...options,
  });
  await service.ready;
  return { service, directory };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function invalidMechanics() {
  const machines = harborMechanics();
  if (machines.config.kind === "simulation")
    machines.config.tasks[0].referenceInputs[0].value = 0;
  return machines;
}

describe("3D durable generation pipeline", () => {
  it("runs source goals, generated machines, playable story and independent review before release", async () => {
    const fake = provider();
    const { service, directory } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    const job = await service.get(created.id);
    expect(
      job.error,
      "Actual source-to-3D compile/review error",
    ).toBeUndefined();
    expect(job).toMatchObject({
      pipeline: "harbor-v1",
      format: "3d",
      status: "ready",
      stage: "ready",
      usage: { totalTokens: 120 },
      resumable: false,
    });
    expect(job.learningPlan?.objectives[0]).toHaveProperty(
      "id",
      "current-resistance",
    );
    expect(job.game?.episode.puzzles[0].config.kind).toBe("simulation");
    expect(job.game?.episode.generation?.review).toMatchObject({
      status: "passed",
    });
    expect(validateGamePackage(job.game).errors).toEqual([]);
    expect(job.episode).toBeUndefined();
    expect(job.game?.episode.objectives).toHaveLength(1);
    for (const method of [fake.plan, fake.mechanics, fake.story, fake.review])
      expect(method).toHaveBeenCalledTimes(1);
    expect(fake.repairBundle).not.toHaveBeenCalled();
    const checkpoint = await readFile(
      join(directory, `${created.id}.json`),
      "utf8",
    );
    expect(checkpoint).not.toContain("test-private-api-key");
    expect(job).not.toHaveProperty("mechanics");
    expect(job).not.toHaveProperty("sources");
  });

  it("compiles an unrelated evidence topic into source-linked physical sorting crates", async () => {
    const fake = provider({
      plan: vi.fn(async () => result(harborEvidencePlan())),
      mechanics: vi.fn(async () => result(harborEvidenceMechanics())),
    });
    const { service } = await setup({
      harborProvider: fake,
      extract: vi.fn(async () => ({
        sources: harborEvidenceSources,
        warnings: [],
      })),
    });
    const created = await service.create({
      format: "3d",
      sourceText: harborEvidenceSources[0].text,
    });
    await service.whenIdle();
    const job = await service.get(created.id);
    expect(job.error, "Evidence compiler error").toBeUndefined();
    expect(job).toMatchObject({
      status: "ready",
      format: "3d",
      usage: { totalTokens: 120 },
    });
    expect(validateGamePackage(job.game).errors).toEqual([]);
    if (job.game?.format !== "3d") throw new Error("Expected a 3D game");
    expect(job.game.episode.scene.stations.bridge.kind).toBe("evidence-crates");
    expect(job.game.episode.scene.stations.lift.kind).toBe("evidence-crates");
    expect(job.game.episode.puzzles[0].config).toEqual(
      harborEvidenceMechanics().config,
    );
    expect(job.game.episode.sources).toEqual(harborEvidenceSources);
    expect(fake.repairMechanics).not.toHaveBeenCalled();
    expect(fake.repairBundle).not.toHaveBeenCalled();
  });

  it("keeps requests without a format on the existing point-and-click pipeline and exposes its compatibility package", async () => {
    const harbor = provider();
    const general: GeneralProvider = {
      plan: vi.fn(async () => result(calculusPlan())),
      mechanics: vi.fn(async () => result(calculusMechanics())),
      story: vi.fn(async () => result(generalStory())),
      review: vi.fn(async () => result(approved())),
      repairMechanics: vi.fn(async () => result(calculusMechanics())),
      repairBundle: vi.fn(async () =>
        result({ mechanics: calculusMechanics(), story: generalStory() }),
      ),
    };
    const { service } = await setup({
      harborProvider: harbor,
      generalProvider: general,
      extract: vi.fn(async () => ({ sources: calculusSources, warnings: [] })),
    });
    const created = await service.create({
      sourceText: calculusSources[0].text,
    });
    await service.whenIdle();
    const job = await service.get(created.id);
    expect(job.error).toBeUndefined();
    expect(job).toMatchObject({
      status: "ready",
      format: "point-and-click",
      pipeline: "general-v1",
    });
    expect(job.game).toEqual({
      version: 1,
      format: "point-and-click",
      episode: job.episode,
    });
    expect(validateGamePackage(job.game).valid).toBe(true);
    expect(harbor.plan).not.toHaveBeenCalled();
    expect(harbor.mechanics).not.toHaveBeenCalled();
    expect(general.review).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown format before source extraction or model work", async () => {
    const extract = vi.fn(async () => ({
      sources: harborSources,
      warnings: [],
    }));
    const fake = provider();
    const { service } = await setup({ extract, harborProvider: fake });
    await expect(
      service.create({
        format: "arbitrary-3d-engine" as "3d",
        sourceText: harborSources[0].text,
      }),
    ).rejects.toMatchObject({ code: "invalid_game_format" });
    expect(extract).not.toHaveBeenCalled();
    expect(fake.plan).not.toHaveBeenCalled();
  });

  it("rejects multiple objectives or fabricated source quotes before creating mechanics", async () => {
    for (const invalid of [
      {
        ...harborPlan(),
        objectives: [
          ...harborPlan().objectives,
          { ...harborPlan().objectives[0], id: "second-objective" },
        ],
      },
      {
        ...harborPlan(),
        objectives: [
          {
            ...harborPlan().objectives[0],
            evidence: [
              {
                sourceId: "source-1",
                quote:
                  "This invented sentence does not appear in the supplied teaching source.",
              },
            ],
          },
        ],
      },
    ]) {
      const fake = provider({ plan: vi.fn(async () => result(invalid)) });
      const { service } = await setup({ harborProvider: fake });
      const created = await service.create({
        format: "3d",
        sourceText: harborSources[0].text,
      });
      await service.whenIdle();
      const job = await service.get(created.id);
      expect(job).toMatchObject({
        status: "failed",
        stage: "learning",
        resumable: false,
        usage: { totalTokens: 30 },
      });
      expect(job.game).toBeUndefined();
      expect(fake.mechanics).not.toHaveBeenCalled();
      expect(fake.story).not.toHaveBeenCalled();
    }
  });

  it("cancels an in-flight story, refuses a concurrent creation, and resumes without repeating completed stages", async () => {
    const called = deferred();
    const fake = provider({
      story: vi
        .fn()
        .mockImplementationOnce(async () => {
          called.resolve();
          return new Promise<never>(() => {});
        })
        .mockImplementation(async () => result(harborStory())),
    });
    const { service } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await called.promise;
    await expect(
      service.create({ format: "3d", sourceText: harborSources[0].text }),
    ).rejects.toMatchObject({ code: "generation_busy" });
    await service.cancel(created.id);
    await service.whenIdle();
    expect(await service.get(created.id)).toMatchObject({
      status: "cancelled",
      stage: "story",
      resumable: true,
      usage: { totalTokens: 60 },
    });
    await service.resume(created.id);
    await service.whenIdle();
    const job = await service.get(created.id);
    expect(job.error).toBeUndefined();
    expect(job.status).toBe("ready");
    expect(fake.plan).toHaveBeenCalledTimes(1);
    expect(fake.mechanics).toHaveBeenCalledTimes(1);
    expect(fake.story).toHaveBeenCalledTimes(2);
  });
  it("rejects unsupported source material without spending on machines or story", async () => {
    const fake = provider({
      plan: vi.fn(async () =>
        result({
          supported: false,
          reason: "No explanation in this material.",
          objectives: [],
          notes: [],
        }),
      ),
    });
    const { service } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: "a topic name",
    });
    await service.whenIdle();
    expect(await service.get(created.id)).toMatchObject({
      status: "failed",
      error: { code: "unsupported_episode_source" },
      usage: { totalTokens: 30 },
      resumable: false,
    });
    expect(fake.mechanics).not.toHaveBeenCalled();
    expect(fake.story).not.toHaveBeenCalled();
  });
  it("repairs a blocking content finding once, rechecks it, and refuses a still-faulty lesson", async () => {
    const fake = provider({
      review: vi.fn(async () =>
        result({
          passed: false,
          summary: "The source and feedback disagree.",
          issues: [
            {
              severity: "blocking" as const,
              objectiveId: "current-resistance",
              problem: "Wrong units in feedback.",
              repair: "Use the actual velocity unit.",
            },
          ],
        }),
      ),
    });
    const { service } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    expect(await service.get(created.id)).toMatchObject({
      status: "failed",
      stage: "review",
      error: { code: "content_review_failed" },
      resumable: false,
    });
    expect(fake.review).toHaveBeenCalledTimes(2);
    expect(fake.repairBundle).toHaveBeenCalledTimes(1);
    expect((await service.get(created.id)).game).toBeUndefined();
  });
  it("resumes after a story timeout without repeating completed plan or mechanics stages", async () => {
    let calls = 0;
    const fake = provider({
      story: vi.fn(async () => {
        if (++calls === 1)
          throw new SourceError(408, "Timed out", "generation_timeout");
        return result(harborStory());
      }),
    });
    const { service } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    expect(await service.get(created.id)).toMatchObject({
      status: "failed",
      stage: "story",
      resumable: true,
    });
    await service.resume(created.id);
    await service.whenIdle();
    expect((await service.get(created.id)).status).toBe("ready");
    expect(fake.plan).toHaveBeenCalledTimes(1);
    expect(fake.mechanics).toHaveBeenCalledTimes(1);
    expect(fake.story).toHaveBeenCalledTimes(2);
  });
  it("persists a cancelled mechanics repair and resumes that same repair after a service restart", async () => {
    const called = deferred();
    const fake = provider({
      mechanics: vi.fn(async () => result(invalidMechanics())),
      repairMechanics: vi.fn(async () => {
        called.resolve();
        return new Promise<never>(() => {});
      }),
    });
    const { service, directory } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await called.promise;
    await service.cancel(created.id);
    await service.whenIdle();
    const checkpoint = JSON.parse(
      await readFile(join(directory, `${created.id}.json`), "utf8"),
    );
    expect(checkpoint).toMatchObject({
      repairs: 1,
      pendingHarborRepair: { kind: "mechanics", attempts: 1 },
    });
    expect(checkpoint.pendingHarborRepair.draft).toEqual(invalidMechanics());
    const next = provider();
    const restarted = new EpisodeJobService({
      directory,
      harborProvider: next,
      getApiKey: () => "test-private-api-key",
    });
    await restarted.ready;
    await restarted.resume(created.id);
    await restarted.whenIdle();
    expect((await restarted.get(created.id)).status).toBe("ready");
    expect(next.plan).not.toHaveBeenCalled();
    expect(next.mechanics).not.toHaveBeenCalled();
    expect(next.repairMechanics).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(await readFile(join(directory, `${created.id}.json`), "utf8"))
        .repairs,
    ).toBe(1);
  });
  it("resumes a timed-out bundle repair without counting it as a second repair pass", async () => {
    let reviewCalls = 0;
    let repairCalls = 0;
    const fake = provider({
      review: vi.fn(async () =>
        result(
          ++reviewCalls === 1
            ? {
                passed: false,
                summary: "A feedback correction is needed.",
                issues: [
                  {
                    severity: "blocking" as const,
                    objectiveId: "current-resistance",
                    problem: "Wrong unit.",
                    repair: "Fix the unit.",
                  },
                ],
              }
            : approved(),
        ),
      ),
      repairBundle: vi.fn(async () => {
        if (++repairCalls === 1)
          throw new SourceError(408, "Timed out", "generation_timeout");
        return result({
          mechanics: harborMechanics(),
          story: harborStory(),
        });
      }),
    });
    const { service, directory } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    expect(await service.get(created.id)).toMatchObject({
      status: "failed",
      resumable: true,
    });
    expect(
      JSON.parse(await readFile(join(directory, `${created.id}.json`), "utf8")),
    ).toMatchObject({
      repairs: 1,
      pendingHarborRepair: { kind: "bundle", attempts: 1 },
    });
    await service.resume(created.id);
    await service.whenIdle();
    expect((await service.get(created.id)).status).toBe("ready");
    expect(fake.story).toHaveBeenCalledTimes(1);
    expect(fake.repairBundle).toHaveBeenCalledTimes(2);
    expect(fake.review).toHaveBeenCalledTimes(2);
  });
  it("bounds explicitly resumed repair attempts without regenerating the initial machines", async () => {
    const fake = provider({
      mechanics: vi.fn(async () => result(invalidMechanics())),
      repairMechanics: vi.fn(async () => {
        throw new SourceError(408, "Timed out", "generation_timeout");
      }),
    });
    const { service } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    for (let i = 0; i < 2; i++) {
      await service.resume(created.id);
      await service.whenIdle();
    }
    expect(await service.get(created.id)).toMatchObject({
      status: "failed",
      resumable: false,
    });
    expect(fake.mechanics).toHaveBeenCalledTimes(1);
    expect(fake.repairMechanics).toHaveBeenCalledTimes(3);
    await expect(service.resume(created.id)).rejects.toMatchObject({
      code: "job_not_resumable",
    });
  });

  it("does not repair or request a fourth review after the third review returns a blocker", async () => {
    let reviewCalls = 0;
    const fake = provider({
      review: vi.fn(async () => {
        reviewCalls += 1;
        if (reviewCalls < 3)
          throw new SourceError(408, "Timed out", "generation_timeout");
        return result({
          passed: false,
          summary: "A feedback correction is needed.",
          issues: [
            {
              severity: "blocking" as const,
              objectiveId: "current-resistance",
              problem: "Wrong unit.",
              repair: "Fix the unit.",
            },
          ],
        });
      }),
    });
    const { service, directory } = await setup({ harborProvider: fake });
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    for (let i = 0; i < 2; i++) {
      await service.resume(created.id);
      await service.whenIdle();
    }
    expect(fake.review).toHaveBeenCalledTimes(3);
    expect(fake.repairBundle).not.toHaveBeenCalled();
    expect(await service.get(created.id)).toMatchObject({
      status: "failed",
      stage: "review",
      error: { code: "stage_attempts_exhausted" },
      resumable: false,
    });
    expect((await service.get(created.id)).game).toBeUndefined();
    const checkpoint = JSON.parse(
      await readFile(join(directory, `${created.id}.json`), "utf8"),
    );
    expect(checkpoint).toMatchObject({
      repairs: 0,
      attempts: { review: 3 },
      harborReview: { passed: false },
    });
    await expect(service.resume(created.id)).rejects.toMatchObject({
      code: "job_not_resumable",
    });
  });

  it("repairs a persisted blocking review before requesting another review after restart", async () => {
    const { service, directory } = await setup();
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    const path = join(directory, `${created.id}.json`);
    const checkpoint = JSON.parse(await readFile(path, "utf8"));
    // Model the crash after saving a failed review but before saving pendingHarborRepair.
    checkpoint.status = "running";
    checkpoint.stage = "review";
    checkpoint.repairs = 0;
    checkpoint.attempts.review = 1;
    checkpoint.game = undefined;
    checkpoint.harborReview = {
      passed: false,
      summary: "A feedback correction is needed.",
      issues: [
        {
          severity: "blocking",
          objectiveId: "current-resistance",
          problem: "Wrong unit.",
          repair: "Fix the unit.",
        },
      ],
    };
    await writeFile(path, JSON.stringify(checkpoint));
    const events: string[] = [];
    const fake = provider({
      repairBundle: vi.fn(async () => {
        events.push("repair");
        return result({ mechanics: harborMechanics(), story: harborStory() });
      }),
      review: vi.fn(async () => {
        events.push("review");
        return result(approved());
      }),
    });
    const restarted = new EpisodeJobService({
      directory,
      harborProvider: fake,
      getApiKey: () => "test-private-api-key",
    });
    await restarted.ready;
    await restarted.resume(created.id);
    await restarted.whenIdle();
    expect(events).toEqual(["repair", "review"]);
    expect(fake.plan).not.toHaveBeenCalled();
    expect(fake.mechanics).not.toHaveBeenCalled();
    expect(fake.story).not.toHaveBeenCalled();
    expect(fake.repairBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        issues: expect.stringContaining("Wrong unit."),
      }),
    );
    expect((await restarted.get(created.id)).status).toBe("ready");
  });

  it("refuses a pending bundle repair when its saved job has no review attempts left", async () => {
    const { service, directory } = await setup();
    const created = await service.create({
      format: "3d",
      sourceText: harborSources[0].text,
    });
    await service.whenIdle();
    const path = join(directory, `${created.id}.json`);
    const checkpoint = JSON.parse(await readFile(path, "utf8"));
    checkpoint.status = "failed";
    checkpoint.stage = "validation";
    checkpoint.error = { code: "generation_timeout", message: "Timed out" };
    checkpoint.repairs = 1;
    checkpoint.attempts.review = 3;
    checkpoint.game = undefined;
    checkpoint.harborReview = undefined;
    checkpoint.pendingHarborRepair = {
      kind: "bundle",
      issues: "Fix the unit.",
      attempts: 1,
    };
    await writeFile(path, JSON.stringify(checkpoint));
    const fake = provider();
    const restarted = new EpisodeJobService({
      directory,
      harborProvider: fake,
      getApiKey: () => "test-private-api-key",
    });
    await restarted.ready;
    expect(await restarted.get(created.id)).toMatchObject({
      status: "failed",
      resumable: false,
    });
    await expect(restarted.resume(created.id)).rejects.toMatchObject({
      code: "job_not_resumable",
    });
    expect(fake.repairBundle).not.toHaveBeenCalled();
    expect(fake.review).not.toHaveBeenCalled();
  });
});
