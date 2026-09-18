import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BONEYARD_ROOT } from "boneyard/paths";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKIPPED = new Set(["node_modules", "dist", ".git"]);

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (SKIPPED.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function sources(directory: string): string[] {
  return filesUnder(join(ROOT, directory)).filter((path) => path.endsWith(".ts"));
}

function specifiers(path: string): string[] {
  const source = readFileSync(path, "utf8");
  const found = [
    ...source.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
  ];
  return found.map((match) => match[1]);
}

/** Where an import lands: a repository-relative path, or the bare specifier itself. */
function target(path: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  return relative(ROOT, resolve(dirname(path), specifier)).split(sep).join("/");
}

function importsFrom(directory: string): Array<{ file: string; to: string }> {
  return sources(directory).flatMap((path) =>
    specifiers(path).map((specifier) => ({ file: relative(ROOT, path).split(sep).join("/"), to: target(path, specifier) })));
}

const inside = (prefix: string) => (to: string): boolean => to.startsWith(prefix);

describe("layer boundaries", () => {
  it("finds the imports it is checking", () => {
    // Guards the guards: a scanner that matched nothing would pass every rule below.
    expect(importsFrom("src/battle").length).toBeGreaterThanOrEqual(8);
    expect(importsFrom("src/combat/kernel").length).toBeGreaterThanOrEqual(15);
    expect(importsFrom("src/render").map(({ to }) => to)).toContain("boneyard/render/depth");
    expect(importsFrom("src/combat").map(({ to }) => to)).toContain("src/battle/director.ts");
  });

  it("keeps the battle layer pure: it imports only itself", () => {
    for (const { file, to } of importsFrom("src/battle")) expect(to, file).toSatisfy(inside("src/battle/"));
  });

  it("seals the kernel: it imports only itself", () => {
    for (const { file, to } of importsFrom("src/combat/kernel")) expect(to, file).toSatisfy(inside("src/combat/kernel/"));
  });

  it("keeps DOM APIs, wall clocks and randomness out of the kernel", () => {
    const forbidden = /\b(?:document|window)\s*\.|\b(?:DOMParser|requestAnimationFrame|HTMLElement|SVGElement)\b|\b(?:Date|performance)\s*\.\s*now\s*\(|\b(?:setTimeout|setInterval|Math\s*\.\s*random)\s*\(/;
    for (const path of sources("src/combat/kernel")) expect(readFileSync(path, "utf8"), path).not.toMatch(forbidden);
  });

  it("lets only the adapter translate actions, and only the frame data name clips", () => {
    for (const { file, to } of importsFrom("src/combat")) {
      if (file.startsWith("src/combat/kernel/")) continue;
      const allowed = to.startsWith("src/combat/")
        || (file === "src/combat/adapter.ts" && to.startsWith("src/battle/"))
        || (file === "src/combat/moves.ts" && to === "boneyard/catalog/clips.json");
      expect(allowed, `${file} imports ${to}`).toBe(true);
    }
  });

  it("keeps rendering on the reading side of the simulation", () => {
    const boneyard = ["boneyard", "boneyard/render/depth", "boneyard/catalog/clips.json"];
    for (const { file, to } of importsFrom("src/render")) {
      expect(to.startsWith("src/render/") || to.startsWith("src/combat/kernel/") || boneyard.includes(to), `${file} imports ${to}`).toBe(true);
    }
  });

  it("composes matches from the layers below and nothing above", () => {
    for (const { file, to } of importsFrom("src/game")) {
      expect(["src/game/", "src/battle/", "src/combat/"].some((prefix) => to.startsWith(prefix)), `${file} imports ${to}`).toBe(true);
    }
  });

  it("keeps browser source independent of the Node pipelines", () => {
    for (const { file, to } of importsFrom("src")) expect(to.startsWith("pipelines/"), `${file} imports ${to}`).toBe(false);
  });
});

describe("vocabulary", () => {
  it("speaks strike, tech and block only above the combat layer", () => {
    const below = [...sources("src/combat/kernel"), join(ROOT, "src/combat/moves.ts"), ...sources("src/render")];
    for (const path of below) {
      expect(readFileSync(path, "utf8"), relative(ROOT, path)).not.toMatch(/["'`](?:strike|tech|block)["'`]/);
    }
  });
});

describe("the dependency direction", () => {
  it("has Boneyard know nothing about FightLab", () => {
    const upstream = [...filesUnder(join(BONEYARD_ROOT, "src")), ...filesUnder(join(BONEYARD_ROOT, "pipelines")), join(BONEYARD_ROOT, "package.json")];
    for (const path of upstream) expect(readFileSync(path, "utf8"), relative(BONEYARD_ROOT, path)).not.toMatch(/fightlab/i);
  });

  it("links Boneyard as its only runtime dependency", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies).toEqual({ boneyard: "file:../Boneyard" });
  });

  it("copies no art, rig or clip into this tree", () => {
    const tracked = filesUnder(ROOT);
    const art = tracked.filter((path) => [".svg", ".png", ".jpg", ".jpeg", ".webp", ".bvh"].includes(extname(path).toLowerCase()));
    expect(art.map((path) => relative(ROOT, path))).toEqual([]);
    for (const path of tracked.filter((file) => /\.(?:ts|json|html|css)$/.test(file))) {
      const source = readFileSync(path, "utf8");
      expect(source, relative(ROOT, path)).not.toMatch(/data-bone\s*=\s*["']/);
      expect(source, relative(ROOT, path)).not.toMatch(/"poses"\s*:\s*\[/);
    }
  });

  it("has no directories for systems that do not exist", () => {
    const speculative = ["accounts", "economy", "inventory", "campaign", "multiplayer", "backend", "analytics", "store"];
    for (const name of speculative) {
      expect(existsSync(join(ROOT, "src", name)), `src/${name}`).toBe(false);
      expect(existsSync(join(ROOT, name)), name).toBe(false);
    }
  });
});
