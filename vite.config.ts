import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { BONEYARD_ROOT } from "boneyard/paths";

import { fighterArtJson } from "./pipelines/figures.ts";
import { FIGURES } from "./src/game/roster.ts";
import { validateSourceReleaseIdentity } from "./pipelines/release-identity.ts";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const FIGHTER = /^\/fighters\/([a-z][a-z0-9-]*)\.json$/;

/**
 * Serves each figure the game draws as Boneyard's loader assembled it, and emits the same bytes into a
 * build. Art is fetched at runtime, never bundled, and nothing here reshapes what Boneyard said.
 */
function boneyardFighters(): Plugin {
  return {
    name: "fightlab-boneyard-fighters",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = FIGHTER.exec((request.url ?? "/").split("?")[0]);
        if (!match) return next();
        try {
          const body = fighterArtJson(match[1]);
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(body);
        } catch (error) {
          response.statusCode = 404;
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          response.end(`${(error as Error).message}\n`);
        }
      });
    },
    generateBundle() {
      for (const figure of FIGURES) {
        this.emitFile({ type: "asset", fileName: `fighters/${figure}.json`, source: fighterArtJson(figure) });
      }
    },
  };
}

function releaseIdentity(): Plugin {
  return {
    name: "fightlab-release-identity",
    generateBundle() {
      const release = process.env.FIGHTLAB_RELEASE;
      if (release) {
        const failures = validateSourceReleaseIdentity({ cwd: ROOT, release });
        if (failures.length) throw new Error(failures.join("; "));
      }
      const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
      this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify({ product: "fightlab", release: release ?? "development", commit })}\n` });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [boneyardFighters(), releaseIdentity()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.FIGHTLAB_PORT ?? "5190"),
    strictPort: true,
    fs: { allow: [ROOT, BONEYARD_ROOT] },
  },
  preview: { host: "127.0.0.1", port: 5191, strictPort: true },
});
