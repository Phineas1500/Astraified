import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import multer from "multer";
import type { SourceRecord } from "../src/domain/types.js";
import type { EpisodePackage } from "../src/episodes/types.js";
import {
  createTransformerFixtures,
  createTransformerReferenceEvidence,
} from "../src/domain/transformers.js";
import {
  extractSources,
  MAX_UPLOAD_BYTES,
  type SourceInput,
} from "./sources.js";
import { SourceError } from "./errors.js";
import {
  compileEpisodeStory,
  EpisodeGenerationError,
  EPISODE_GENERATION_SETTINGS,
  defaultEpisodeProvider,
  validateLearningPlan,
  zeroUsage,
  type EpisodeLearningPlan,
  type EpisodeProvider,
  type EpisodeStory,
  type EpisodeUsage,
  type GenerationResult,
  type ReviewedPuzzles,
} from "./episode-generation.js";

export type EpisodeJobStatus =
  "queued" | "running" | "interrupted" | "cancelled" | "failed" | "ready";
export type EpisodeJobStage =
  "source" | "learning" | "story" | "validation" | "ready";
export interface EpisodeJobView {
  id: string;
  status: EpisodeJobStatus;
  stage: EpisodeJobStage;
  progress: number;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
  learningPlan?: EpisodeLearningPlan;
  episode?: EpisodePackage;
  error?: { code: string; message: string };
  usage: EpisodeUsage;
  resumable: boolean;
}
interface StoredJob extends Omit<EpisodeJobView, "resumable"> {
  version: 1;
  topic: string;
  level: string;
  sources: SourceRecord[];
  draft?: EpisodeStory;
  repairs: number;
  attempts: { learning: number; story: number };
}
export interface EpisodeJobOptions {
  directory?: string;
  /** Exact local frontend origins when a dev proxy rewrites the API Host. */
  webOrigins?: string[];
  provider?: EpisodeProvider;
  extract?: typeof extractSources;
  getApiKey?: () => string | undefined;
  stageTimeoutMs?: number;
  learningTimeoutMs?: number;
  storyTimeoutMs?: number;
  reviewedPuzzles?: ReviewedPuzzles;
  compile?: typeof compileEpisodeStory;
}

const JOB_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RECOVERABLE = new Set([
  "generation_timeout",
  "provider_error",
  "api_quota",
  "api_not_configured",
  "api_authentication",
  "model_unavailable",
  "incomplete_generation",
]);
const MAX_STAGE_ATTEMPTS = 3;
const statusValues = new Set<EpisodeJobStatus>([
  "queued",
  "running",
  "interrupted",
  "cancelled",
  "failed",
  "ready",
]);
const stageValues = new Set<EpisodeJobStage>([
  "source",
  "learning",
  "story",
  "validation",
  "ready",
]);

function canResume(job: StoredJob): boolean {
  if (
    !["interrupted", "cancelled", "failed"].includes(job.status) ||
    !job.sources.length
  )
    return false;
  if (
    job.status === "failed" &&
    (!job.error || !RECOVERABLE.has(job.error.code))
  )
    return false;
  if (!job.learningPlan && job.attempts.learning >= MAX_STAGE_ATTEMPTS)
    return false;
  if (
    job.learningPlan &&
    !job.draft &&
    job.attempts.story >= MAX_STAGE_ATTEMPTS
  )
    return false;
  if (
    job.status === "failed" &&
    job.stage === "validation" &&
    job.repairs > 0 &&
    job.error
  )
    return false;
  return true;
}

function jobView(job: StoredJob): EpisodeJobView {
  const {
    id,
    status,
    stage,
    progress,
    createdAt,
    updatedAt,
    warnings,
    learningPlan,
    episode,
    error,
    usage,
  } = job;
  return structuredClone({
    id,
    status,
    stage,
    progress,
    createdAt,
    updatedAt,
    warnings,
    learningPlan,
    episode,
    error,
    usage,
    resumable: canResume(job),
  });
}
function publicError(error: unknown): { code: string; message: string } {
  return error instanceof SourceError
    ? { code: error.code, message: error.message.slice(0, 1800) }
    : {
        code: "job_failed",
        message:
          "The adventure could not be completed. Completed checkpoints remain on this computer.",
      };
}
function reviewedFixtures(): ReviewedPuzzles {
  const fixtures = createTransformerFixtures();
  return Object.fromEntries(
    (["positions", "attention", "causal"] as const).map((id) => {
      const config = id === "positions" ? fixtures.position : fixtures[id];
      return [
        id,
        { config, evidence: createTransformerReferenceEvidence(config) },
      ];
    }),
  ) as ReviewedPuzzles;
}
const apparatusDescriptions = {
  positions:
    "Illustrative token tape. Player reorders token tiles, switches positional information on/off, and measures representations in a controlled pair at the SAME changed order. Then restore original order with positions enabled. Repeated identical tokens share embeddings. This is representation arithmetic, not a whole language model or real semantic coordinates.",
  attention:
    "Illustrative attention bench. Player chooses keys or values for the score input, keys or values for the payload, and sqrt(d_k) or no scaling. They test faulty and repaired settings, then change one VALUE only and observe weights stay fixed while output changes. Correct installation scores query against keys, divides by sqrt(d_k), uses softmax weights to mix values. No quiz or freeform matrix editor.",
  causal:
    "Visibility shutters for an autoregressive self-attention query. Player opens/closes token slots and runs future-change and earlier-context-change trials. First demonstrate the future leak with every shutter open. Then allow current input position and earlier positions, block later ones: future changes no longer affect output, earlier context still can. Repeat on an automatically longer transfer tape at a later query position. Labels refer to shifted next-token input, not an unshifted target that can see itself.",
};

/** Local, private checkpoints. Raw uploads and API keys never enter the durable record. */
export class EpisodeJobService {
  readonly ready: Promise<void>;
  private directory: string;
  private jobs = new Map<string, StoredJob>();
  private writes = new Map<string, Promise<void>>();
  private active?: {
    id: string;
    controller: AbortController;
    task?: Promise<void>;
  };
  private reserving = false;
  private provider: EpisodeProvider;
  private extract: typeof extractSources;
  private getApiKey: () => string | undefined;
  private learningTimeout: number;
  private storyTimeout: number;
  private puzzles: ReviewedPuzzles;
  private apparatus: Record<
    string,
    {
      description: string;
      kind: string;
      tokenCount: number;
      dimensions: number;
    }
  >;
  private compile: typeof compileEpisodeStory;

  constructor(options: EpisodeJobOptions = {}) {
    this.directory = resolve(options.directory || ".astraified/jobs");
    this.provider = options.provider || defaultEpisodeProvider;
    this.extract = options.extract || extractSources;
    this.getApiKey =
      options.getApiKey || (() => process.env.OPENAI_API_KEY?.trim());
    this.learningTimeout =
      options.learningTimeoutMs ??
      options.stageTimeoutMs ??
      EPISODE_GENERATION_SETTINGS.learning.timeoutMs;
    this.storyTimeout =
      options.storyTimeoutMs ??
      options.stageTimeoutMs ??
      EPISODE_GENERATION_SETTINGS.story.timeoutMs;
    this.puzzles = options.reviewedPuzzles || reviewedFixtures();
    this.apparatus = Object.fromEntries(
      Object.entries(this.puzzles).map(([id, puzzle]) => {
        const config = puzzle.config;
        return [
          id,
          {
            description:
              apparatusDescriptions[id as keyof typeof apparatusDescriptions],
            kind: config.kind,
            tokenCount: config.tokens.length,
            dimensions:
              config.kind === "attention"
                ? config.query.length
                : config.embeddings[0].length,
          },
        ];
      }),
    );
    this.compile = options.compile || compileEpisodeStory;
    this.ready = this.load();
  }
  private async load() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    const files = await readdir(this.directory);
    for (const file of files
      .filter(
        (name) => name.endsWith(".json") && JOB_ID.test(name.slice(0, -5)),
      )
      .slice(-100)) {
      try {
        const path = resolve(this.directory, file);
        if ((await stat(path)).size > 3_000_000) continue;
        const data = JSON.parse(await readFile(path, "utf8")) as StoredJob;
        if (
          data.version !== 1 ||
          data.id !== file.slice(0, -5) ||
          !statusValues.has(data.status) ||
          !stageValues.has(data.stage) ||
          !Array.isArray(data.sources) ||
          !Array.isArray(data.warnings) ||
          !data.attempts ||
          !data.usage ||
          !Number.isSafeInteger(data.attempts.learning) ||
          !Number.isSafeInteger(data.attempts.story) ||
          !Number.isSafeInteger(data.repairs)
        )
          continue;
        this.jobs.set(data.id, data);
        if (data.status === "running" || data.status === "queued") {
          data.status = "interrupted";
          data.error = {
            code: "server_restarted",
            message:
              "The server restarted during generation. Resume to continue from the last completed checkpoint.",
          };
          await this.persist(data);
        }
      } catch {
        /* Ignore incomplete/corrupt local files; never invent a replacement adventure. */
      }
    }
  }
  private async persist(job: StoredJob) {
    job.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(job);
    const before = this.writes.get(job.id) || Promise.resolve();
    const write = before
      .catch(() => {})
      .then(async () => {
        const target = resolve(this.directory, `${job.id}.json`);
        const temporary = resolve(
          this.directory,
          `${job.id}.${randomUUID()}.tmp`,
        );
        await writeFile(temporary, snapshot, { mode: 0o600, flag: "wx" });
        await rename(temporary, target);
      });
    this.writes.set(job.id, write);
    await write;
    if (this.writes.get(job.id) === write) this.writes.delete(job.id);
  }
  private requireKey() {
    const key = this.getApiKey();
    if (!key)
      throw new SourceError(
        503,
        "Add a server API key before generating. The authored episodes remain playable.",
        "api_not_configured",
      );
    return key;
  }
  async create(
    input: SourceInput & { topic?: string; level?: string },
    signal?: AbortSignal,
  ): Promise<EpisodeJobView> {
    await this.ready;
    if (this.active || this.reserving)
      throw new SourceError(
        429,
        "Another adventure is already generating. Finish or cancel it first.",
        "generation_busy",
      );
    this.requireKey();
    this.reserving = true;
    try {
      // Extraction finishes before accepting a durable job. A restart never needs a raw uploaded file.
      const extractionTimeout = AbortSignal.timeout(
        Math.min(this.learningTimeout, 25_000),
      );
      const extractionSignal = signal
        ? AbortSignal.any([signal, extractionTimeout])
        : extractionTimeout;
      extractionSignal.throwIfAborted();
      let extracted: Awaited<ReturnType<typeof extractSources>>;
      try {
        extracted = await this.extract(input, extractionSignal);
      } catch (error) {
        if (error instanceof SourceError && error.code === "source_required")
          throw new SourceError(
            422,
            "Add a focused source excerpt explaining token positions, attention, and causal masking. A topic name alone is not enough.",
            "source_required",
          );
        throw error;
      }
      extractionSignal.throwIfAborted();
      const now = new Date().toISOString();
      const job: StoredJob = {
        version: 1,
        id: randomUUID(),
        status: "queued",
        stage: "learning",
        progress: 15,
        createdAt: now,
        updatedAt: now,
        topic: (input.topic || "Transformer neural networks").slice(0, 300),
        level: (input.level || "High school / college").slice(0, 100),
        sources: extracted.sources,
        warnings: [
          ...extracted.warnings,
          "This version generates the story and interactions around reviewed Transformer instruments and reuses the original harbor art kit.",
        ],
        usage: zeroUsage(),
        repairs: 0,
        attempts: { learning: 0, story: 0 },
      };
      await this.persist(job);
      this.jobs.set(job.id, job);
      if (signal?.aborted) {
        job.status = "cancelled";
        await this.persist(job);
        throw new SourceError(
          408,
          "Source import was cancelled before generation began.",
          "source_cancelled",
        );
      }
      this.launch(job);
      return jobView(job);
    } finally {
      this.reserving = false;
    }
  }
  async get(id: string): Promise<EpisodeJobView> {
    await this.ready;
    return jobView(this.find(id));
  }
  private find(id: string) {
    if (!JOB_ID.test(id) || !this.jobs.has(id))
      throw new SourceError(
        404,
        "This local generation job could not be found.",
        "job_not_found",
      );
    return this.jobs.get(id)!;
  }
  async cancel(id: string) {
    await this.ready;
    const job = this.find(id);
    if (
      job.status === "ready" ||
      job.status === "failed" ||
      job.status === "cancelled" ||
      job.status === "interrupted"
    )
      return jobView(job);
    if (this.active?.id === id) this.active.controller.abort();
    job.status = "cancelled";
    job.error = undefined;
    await this.persist(job);
    return jobView(job);
  }
  async resume(id: string) {
    await this.ready;
    const job = this.find(id);
    if (!canResume(job))
      throw new SourceError(
        409,
        "This job has no resumable stage. Start a new job with suitable source material.",
        "job_not_resumable",
      );
    if (this.active || this.reserving)
      throw new SourceError(
        429,
        "Another adventure is already generating. Wait for it to stop.",
        "generation_busy",
      );
    this.requireKey();
    this.reserving = true;
    try {
      job.status = "queued";
      job.error = undefined;
      await this.persist(job);
      this.launch(job);
      return jobView(job);
    } finally {
      this.reserving = false;
    }
  }
  /** Tests/host shutdown can await the current worker without polling. */
  async whenIdle() {
    await this.ready;
    await this.active?.task;
  }
  private launch(job: StoredJob) {
    const active = {
      id: job.id,
      controller: new AbortController(),
      task: undefined as Promise<void> | undefined,
    };
    this.active = active;
    active.task = this.run(job, active.controller.signal).finally(() => {
      if (this.active === active) this.active = undefined;
    });
  }
  private async stage<T>(
    signal: AbortSignal,
    call: (stageSignal: AbortSignal) => Promise<GenerationResult<T>>,
    timeoutMs = this.learningTimeout,
  ) {
    signal.throwIfAborted();
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = AbortSignal.any([signal, timeout]);
    let stop: (() => void) | undefined;
    try {
      return await Promise.race([
        call(combined),
        new Promise<never>((_resolve, reject) => {
          stop = () =>
            reject(
              new SourceError(
                408,
                "This generation stage timed out or was cancelled. Completed checkpoints are preserved.",
                "generation_timeout",
              ),
            );
          if (combined.aborted) stop();
          else combined.addEventListener("abort", stop, { once: true });
        }),
      ]);
    } finally {
      if (stop) combined.removeEventListener("abort", stop);
    }
  }
  private addUsage(job: StoredJob, usage: EpisodeUsage) {
    for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const)
      if (Number.isFinite(usage[key]) && usage[key] >= 0)
        job.usage[key] += usage[key];
  }
  private async run(job: StoredJob, signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      job.status = "running";
      await this.persist(job);
      const base = () => ({
        sources: job.sources,
        topic: job.topic,
        level: job.level,
        apiKey: this.requireKey(),
      });
      if (!job.learningPlan) {
        job.stage = "learning";
        job.progress = 20;
        job.attempts.learning += 1;
        await this.persist(job);
        const result = await this.stage(signal, (stageSignal) =>
          this.provider.plan({
            ...base(),
            signal: stageSignal,
            timeoutMs: this.learningTimeout,
            apparatus: this.apparatus,
          }),
        );
        signal.throwIfAborted();
        this.addUsage(job, result.usage);
        await this.persist(job); // Preserve usage even when semantic/quote validation rejects the plan.
        job.learningPlan = validateLearningPlan(result.value, job.sources);
        job.progress = 40;
        await this.persist(job);
      }
      if (!job.draft) {
        job.stage = "story";
        job.progress = 45;
        job.attempts.story += 1;
        await this.persist(job);
        const result = await this.stage(
          signal,
          (stageSignal) =>
            this.provider.story({
              ...base(),
              plan: job.learningPlan!,
              apparatus: this.apparatus,
              signal: stageSignal,
              timeoutMs: this.storyTimeout,
            }),
          this.storyTimeout,
        );
        signal.throwIfAborted();
        this.addUsage(job, result.usage);
        job.draft = result.value;
        job.progress = 75;
        await this.persist(job);
      }
      job.stage = "validation";
      job.progress = 80;
      await this.persist(job);
      const compile = () =>
        this.compile({
          raw: job.draft,
          plan: job.learningPlan!,
          sources: job.sources,
          level: job.level,
          id: `generated-${job.id}`,
          createdAt: job.createdAt,
          reviewedPuzzles: this.puzzles,
        });
      let episode: EpisodePackage;
      try {
        episode = compile();
      } catch (error) {
        if (job.repairs >= 1) throw error;
        job.repairs += 1;
        job.progress = 85;
        await this.persist(job);
        const result = await this.stage(
          signal,
          (stageSignal) =>
            this.provider.repair({
              ...base(),
              plan: job.learningPlan!,
              apparatus: this.apparatus,
              draft: job.draft,
              issues: publicError(error).message,
              signal: stageSignal,
              timeoutMs: this.storyTimeout,
            }),
          this.storyTimeout,
        );
        signal.throwIfAborted();
        this.addUsage(job, result.usage);
        job.draft = result.value;
        await this.persist(job);
        episode = compile();
      }
      signal.throwIfAborted();
      job.episode = episode;
      job.status = "ready";
      job.stage = "ready";
      job.progress = 100;
      job.error = undefined;
      await this.persist(job);
    } catch (error) {
      if (error instanceof EpisodeGenerationError && error.usage)
        this.addUsage(job, error.usage);
      if (signal.aborted) {
        job.status = "cancelled";
        job.error = undefined;
      } else {
        job.status = "failed";
        job.error = publicError(error);
      }
      try {
        await this.persist(job);
      } catch {
        /* Keep the sanitized in-memory failure available to the UI. */
      }
    }
  }
}

const DEFAULT_WEB_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"];

export function createEpisodeWriteGuard(
  webOrigins = DEFAULT_WEB_ORIGINS,
): express.RequestHandler {
  const allowed = new Set(webOrigins);
  return (request, response, next) => {
    if (request.headers["sec-fetch-site"] === "cross-site")
      return response.status(403).json({
        error: {
          code: "invalid_origin",
          message: "Open the local Astraified app to change generation jobs.",
        },
      });
    const origin = request.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
          parsed.origin !== origin ||
          (parsed.host !== request.headers.host && !allowed.has(origin))
        )
          throw new Error();
      } catch {
        return response.status(403).json({
          error: {
            code: "invalid_origin",
            message:
              "Generation jobs accept requests from this local app only.",
          },
        });
      }
    }
    next();
  };
}

export const episodeWriteGuard = createEpisodeWriteGuard();

export function createEpisodeRouter(options: EpisodeJobOptions = {}) {
  const router = express.Router();
  const service = new EpisodeJobService(options);
  const writeGuard = createEpisodeWriteGuard(options.webOrigins);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: 5,
      fieldSize: 80_000,
      parts: 7,
    },
  });
  router.post(
    "/jobs",
    writeGuard,
    upload.single("file"),
    async (request, response, next) => {
      const controller = new AbortController();
      response.on("close", () => {
        if (!response.writableEnded) controller.abort();
      });
      try {
        const fields = request.body || {};
        for (const name of ["sourceText", "sourceUrl", "level", "topic"])
          if (fields[name] !== undefined && typeof fields[name] !== "string")
            throw new SourceError(400, `Provide one text value for ${name}.`);
        const job = await service.create(
          {
            sourceText: fields.sourceText,
            sourceUrl: fields.sourceUrl,
            level: fields.level,
            topic: fields.topic,
            file: request.file,
          },
          controller.signal,
        );
        response.status(202).json({ job });
      } catch (error) {
        if (!response.destroyed) next(error);
      }
    },
  );
  router.get("/jobs/:id", async (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      response.json({ job: await service.get(String(request.params.id)) });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/jobs/:id/cancel",
    writeGuard,
    async (request, response, next) => {
      try {
        response.json({ job: await service.cancel(String(request.params.id)) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/jobs/:id/resume",
    writeGuard,
    async (request, response, next) => {
      try {
        response
          .status(202)
          .json({ job: await service.resume(String(request.params.id)) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        error instanceof SourceError
          ? error.status
          : error instanceof multer.MulterError
            ? 413
            : 500;
      response.status(status).json({
        error:
          error instanceof multer.MulterError
            ? {
                code: "invalid_upload",
                message:
                  "Use one source file under 10 MB and a focused excerpt.",
              }
            : publicError(error),
      });
    },
  );
  return router;
}
