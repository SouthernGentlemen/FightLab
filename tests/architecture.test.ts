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
    expect(importsFrom("src/mods").map(({ to }) => to)).toContain("src/battle/actions.ts");
    expect(importsFrom("src/run").map(({ to }) => to)).toContain("src/mods/compile.ts");
    expect(importsFrom("src/combat/kernel").length).toBeGreaterThanOrEqual(15);
    expect(importsFrom("src/render").map(({ to }) => to)).toContain("boneyard/render/depth");
    expect(importsFrom("src/combat").map(({ to }) => to)).toContain("src/battle/director.ts");
  });

  it("keeps the battle layer pure: it imports only itself", () => {
    for (const { file, to } of importsFrom("src/battle")) expect(to, file).toSatisfy(inside("src/battle/"));
  });

  it("builds mods over the battle vocabulary and nothing else", () => {
    for (const { file, to } of importsFrom("src/mods")) {
      expect(["src/mods/", "src/battle/"].some((prefix) => to.startsWith(prefix)), `${file} imports ${to}`).toBe(true);
    }
  });

  it("runs the run over mods and battle, never over combat, rendering or the UI", () => {
    for (const { file, to } of importsFrom("src/run")) {
      expect(["src/run/", "src/mods/", "src/battle/"].some((prefix) => to.startsWith(prefix)), `${file} imports ${to}`).toBe(true);
    }
  });

  it("seals the kernel: it imports only itself", () => {
    for (const { file, to } of importsFrom("src/combat/kernel")) expect(to, file).toSatisfy(inside("src/combat/kernel/"));
  });

  it("keeps DOM APIs, wall clocks and randomness out of the kernel", () => {
    const forbidden = /\b(?:document|window)\s*\.|\b(?:DOMParser|requestAnimationFrame|HTMLElement|SVGElement)\b|\b(?:Date|performance)\s*\.\s*now\s*\(|\b(?:setTimeout|setInterval|Math\s*\.\s*random)\s*\(/;
    for (const path of sources("src/combat/kernel")) expect(readFileSync(path, "utf8"), path).not.toMatch(forbidden);
  });

  it("keeps unseeded randomness and wall clocks out of every rule", () => {
    const forbidden = /\bMath\s*\.\s*random\b|\bcrypto\s*\.|\b(?:Date|performance)\s*\.\s*now\s*\(|\bnew\s+Date\b|\b(?:document|window)\s*\./;
    for (const path of [...sources("src/battle"), ...sources("src/mods"), ...sources("src/run")]) {
      expect(readFileSync(path, "utf8"), relative(ROOT, path)).not.toMatch(forbidden);
    }
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
    const boneyard = ["boneyard", "boneyard/render/depth"];
    for (const { file, to } of importsFrom("src/render")) {
      expect(to.startsWith("src/render/") || to.startsWith("src/combat/kernel/") || to.startsWith("boneyard/motions/authored/lab") || boneyard.includes(to), `${file} imports ${to}`).toBe(true);
    }
  });

  it("composes fights from the layers below and nothing above", () => {
    for (const { file, to } of importsFrom("src/game")) {
      expect(["src/game/", "src/battle/", "src/combat/", "src/mods/", "src/run/"].some((prefix) => to.startsWith(prefix)), `${file} imports ${to}`).toBe(true);
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

describe("mod presentation", () => {
  it("uses type/affinity diagonal art and printed effects without mod action glyphs", () => {
    const css = readFileSync(join(ROOT, "src/ui/styles.css"), "utf8");
    const kit = readFileSync(join(ROOT, "src/ui/kit.ts"), "utf8");
    const catalog = readFileSync(join(ROOT, "src/ui/catalogcardview.ts"), "utf8");

    expect(css).not.toMatch(/--c[12]\b|data-c[12]/);
    expect(css).toContain("linear-gradient(135deg, var(--piece-type) 50%, var(--piece-affinity, var(--piece-type)) 50%)");
    expect(kit).not.toMatch(/\bpaintTags\b|\bmodIcon\b/);
    expect(kit).not.toContain("mod__action");
    expect(catalog).not.toContain("catalog-card__action");
    expect(kit).toContain('"data-type": definition.type');
    expect(kit).toContain('"data-affinity": definition.affinity ?? undefined');
    expect(catalog).toContain('"data-type": model.type');
    expect(catalog).toContain('"data-affinity": model.affinity ?? undefined');
    expect(catalog).toContain("pieceMarkText(model.badges)");
  });
});

describe("retired mod vocabulary", () => {
  const modCode = ["src/mods", "src/ui", "src/run", "src/game"].flatMap((directory) =>
    filesUnder(join(ROOT, directory)).filter((path) => [".ts", ".css"].includes(extname(path))));

  it("keeps ports, tags, material identifiers, tiers and retired resources out", () => {
    expect(existsSync(join(ROOT, "src/mods/ports.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/mods/tags.ts"))).toBe(false);

    const forbidden = [
      /\bports?\b|data-port|\b(?:north|south|east|west)Port\b/i,
      /\btags\b|\bModTags?\b|\bMAX_TAGS\b|data-tag/i,
      /\bMATERIALS\b|data-material/,
      /\bT[1-3]\b/,
      /\b(?:heat|charge|voidCharge|capacity|leech|refund|accrue)\b/i,
    ];
    for (const path of modCode) {
      const source = readFileSync(path, "utf8");
      const file = relative(ROOT, path);
      for (const pattern of forbidden) expect(source, `${file} contains retired mod vocabulary`).not.toMatch(pattern);
    }
  });

  it("keeps multiplicity counts off mod cards", () => {
    // These are multiplication readouts, not mod-card ownership counts.
    const allowed = new Map<string, readonly string[]>([
      ["src/ui/kit.ts", ["×${meter.chain}"]],
      ["src/ui/payday.ts", ["×${build.styleMultiplier}"]],
    ]);
    for (const path of sources("src/ui")) {
      const file = relative(ROOT, path).split(sep).join("/");
      let source = readFileSync(path, "utf8");
      for (const snippet of allowed.get(file) ?? []) source = source.replaceAll(snippet, "");
      expect(source, `${file} contains a × count`).not.toMatch(/×\s*(?:\d+|\$\{)/);
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
