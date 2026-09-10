import "dotenv/config";
import express from "express";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { SourceError } from "./errors.js";
import { extractSources, MAX_UPLOAD_BYTES } from "./sources.js";
import { generateMission, MODEL } from "./generation.js";
import { createEpisodeRouter, type EpisodeJobOptions } from "./episode-jobs.js";
import {
  createHostedAccess,
  readHostedAccessConfig,
  type HostedAccessEnvironment,
} from "./hosted-access.js";

export function createApp(
  options: {
    episodeJobs?: EpisodeJobOptions | false;
    hostedEnvironment?: HostedAccessEnvironment;
  } = {},
) {
  const hostedConfig = readHostedAccessConfig(options.hostedEnvironment);
  const hostedAccess = createHostedAccess(hostedConfig);
  const app = express();
  app.disable("x-powered-by");
  app.use("/api/session", hostedAccess.sessionRouter);
  app.use("/api", hostedAccess.protectApi);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: 6,
      fieldSize: 80_000,
      parts: 8,
    },
  });
  let generationActive = false;
  app.get("/api/health", (_request, response) =>
    response.json({
      ok: true,
      model: MODEL,
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    }),
  );
  if (options.episodeJobs !== false)
    app.use(
      "/api/episodes",
      createEpisodeRouter({
        ...options.episodeJobs,
        ...(hostedConfig.enabled
          ? { webOrigins: hostedConfig.origins, requireOrigin: true }
          : {}),
      }),
    );
  app.post(
    "/api/generate",
    (request, response, next) => {
      // Hosted requests were authenticated and checked against exact origins above.
      if (hostedConfig.enabled) return next();
      // This private demo's credit-bearing API is only for its local UI/CLI.
      const origin = request.headers.origin;
      if (origin) {
        try {
          const parsed = new URL(origin);
          if (
            !["http:", "https:"].includes(parsed.protocol) ||
            !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
          )
            throw new Error();
        } catch {
          response.status(403).json({
            error:
              "Generation is available only from the local Astraified app.",
            code: "invalid_origin",
          });
          return;
        }
      }
      if (request.headers["sec-fetch-site"] === "cross-site") {
        response.status(403).json({
          error: "Open the local Astraified app to generate.",
          code: "invalid_origin",
        });
        return;
      }
      next();
    },
    upload.single("file"),
    async (request, response, next) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 110_000);
      response.on("close", () => {
        if (!response.writableEnded) controller.abort();
      });
      let acquired = false;
      try {
        if (generationActive)
          throw new SourceError(
            429,
            "Another mission is already generating. Wait for it to finish before starting another.",
            "generation_busy",
          );
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey)
          throw new SourceError(
            503,
            "Add OPENAI_API_KEY to your local .env file and restart the API server. You can still play the reference mission.",
            "api_not_configured",
          );
        const fields = request.body || {};
        for (const name of [
          "topic",
          "level",
          "mode",
          "sourceText",
          "sourceUrl",
        ])
          if (fields[name] !== undefined && typeof fields[name] !== "string")
            throw new SourceError(400, `Provide one text value for ${name}.`);
        const topic = (fields.topic || "").trim().slice(0, 300);
        const level = (fields.level || "High school / college")
          .trim()
          .slice(0, 100);
        const mode = fields.mode || "adventure";
        if (!["adventure", "explore"].includes(mode))
          throw new SourceError(400, "Choose adventure or explore mode.");
        generationActive = true;
        acquired = true;
        const { sources, warnings } = await extractSources(
          {
            sourceText: fields.sourceText,
            sourceUrl: fields.sourceUrl,
            file: request.file,
          },
          controller.signal,
        );
        controller.signal.throwIfAborted();
        const result = await generateMission({
          sources,
          topic,
          level,
          mode,
          signal: controller.signal,
          apiKey,
        });
        if (!response.destroyed) response.json({ ...result, warnings });
      } catch (error) {
        if (!response.destroyed) next(error);
      } finally {
        clearTimeout(timer);
        if (acquired) generationActive = false;
      }
    },
  );
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof SourceError) {
        response
          .status(error.status)
          .json({ error: error.message, code: error.code });
        return;
      }
      if (error instanceof multer.MulterError) {
        response.status(413).json({
          error: "Use one file under 10 MB and a focused source excerpt.",
          code: "upload_limit",
        });
        return;
      }
      response.status(500).json({
        error: "The server could not complete this request. Please retry.",
        code: "server_error",
      });
    },
  );
  return app;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 8787);
  createApp().listen(port, "127.0.0.1", () =>
    console.log(`Astraified API ready at http://127.0.0.1:${port}`),
  );
}
