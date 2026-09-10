import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

// Use a separate private configuration and checkpoint store from npm run dev.
// This entrypoint must never fall back to the unauthenticated local API.
const config = parse(readFileSync(".astraified/hosted.env"));
for (const key of ["ASTRAIFIED_PUBLIC_ORIGINS", "ASTRAIFIED_ACCESS_CODE", "ASTRAIFIED_SESSION_SECRET", "OPENAI_API_KEY"])
  if (!config[key]?.trim()) throw new Error(`Missing ${key} in .astraified/hosted.env`);
const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...config,
    PORT: config.PORT || "8788",
    ASTRAIFIED_JOB_DIRECTORY: config.ASTRAIFIED_JOB_DIRECTORY || ".astraified/hosted-jobs",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
