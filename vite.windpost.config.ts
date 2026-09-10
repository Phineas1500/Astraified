import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { cpSync, mkdirSync } from "node:fs";

export default defineConfig({
  cacheDir: "artifacts/.vite-windpost",
  resolve: { dedupe: ["react", "react-dom"] },
  plugins: [
    react(),
    {
      name: "windpost-authored-assets",
      apply: "build",
      closeBundle() {
        const output = resolve(import.meta.dirname, "dist/windpost");
        mkdirSync(resolve(output, "models"), { recursive: true });
        cpSync(
          resolve(import.meta.dirname, "public/models/windpost"),
          resolve(output, "models/windpost"),
          { recursive: true },
        );
        cpSync(
          resolve(import.meta.dirname, "public/favicon.svg"),
          resolve(output, "favicon.svg"),
        );
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: {
    outDir: "dist/windpost",
    copyPublicDir: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: { input: resolve(import.meta.dirname, "windpost.html") },
  },
});
