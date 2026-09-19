import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrastRatio, oklabDeltaE } from "./palette-metrics.ts";

const CSS = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");
const ICON_SOURCE = readFileSync(new URL("../../src/ui/icons.ts", import.meta.url), "utf8");
const SEPARATION = 0.13;

const SURFACES = [
  "--surface-root",
  "--surface-panel",
  "--surface-card",
  "--surface-card-hover",
  "--surface-selected",
] as const;
const CARD_SURFACES = ["--surface-card", "--surface-card-hover", "--surface-selected"] as const;
const TYPES = ["--mod-solar", "--mod-arc", "--mod-void", "--mod-neutral"] as const;
const ACTIONS = ["--action-strike", "--action-tech", "--action-block"] as const;
const RARITIES = [
  "--rarity-common",
  "--rarity-uncommon",
  "--rarity-rare",
  "--rarity-super-rare",
  "--rarity-legendary",
] as const;

function rootBlock(css: string): string {
  const start = css.indexOf(":root");
  const open = css.indexOf("{", start);
  if (start < 0 || open < 0) throw new Error("Missing :root palette");

  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === "{") depth++;
    if (css[index] === "}" && --depth === 0) return css.slice(open + 1, index);
  }
  throw new Error("Unclosed :root palette");
}

function tokenMap(css: string): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  for (const match of rootBlock(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

function resolve(name: string, tokens: ReadonlyMap<string, string>, trail: readonly string[] = []): string {
  if (trail.includes(name)) throw new Error(`Circular token reference: ${[...trail, name].join(" -> ")}`);
  const raw = tokens.get(name);
  if (!raw) throw new Error(`Missing token ${name}`);

  return raw.replace(/var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/g, (_whole, nested: string, fallback: string | undefined) => {
    if (tokens.has(nested)) return resolve(nested, tokens, [...trail, name]);
    if (fallback !== undefined) return fallback.trim();
    throw new Error(`Missing token ${nested}, referenced by ${name}`);
  }).trim();
}

function color(name: string, tokens: ReadonlyMap<string, string>): string {
  const value = resolve(name, tokens);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} must resolve to #rrggbb, got ${value}`);
  return value;
}

function expectContrast(
  foregrounds: readonly string[],
  backgrounds: readonly string[],
  minimum: number,
  tokens: ReadonlyMap<string, string>,
): void {
  for (const foreground of foregrounds) {
    for (const background of backgrounds) {
      expect(
        contrastRatio(color(foreground, tokens), color(background, tokens)),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  }
}

function expectSeparated(first: string, second: string, tokens: ReadonlyMap<string, string>): void {
  expect(
    oklabDeltaE(color(first, tokens), color(second, tokens)),
    `${first} vs ${second}`,
  ).toBeGreaterThanOrEqual(SEPARATION);
}

const MOD_PREFIXES = ["catalog", "detail", "filter", "mod", "piece", "cell", "slot", "offer", "tip"];
const LITERAL_ALLOWLIST = new Set([
  ".slot.is-target|#fff7d6",
  ".cell.is-ok|#c9f2cf",
  ".cell.is-bad|#ffd0d5",
]);

function withoutRoot(css: string): string {
  const block = rootBlock(css);
  const bodyStart = css.indexOf(block);
  return css.slice(0, bodyStart) + css.slice(bodyStart + block.length);
}

function isModRule(selector: string): boolean {
  return selector.split(",").some((part) => {
    const first = part.trim().match(/^\.([\w-]+)/)?.[1];
    return first !== undefined && MOD_PREFIXES.some((prefix) => first.startsWith(prefix));
  });
}

describe("mod palette", () => {
  const tokens = tokenMap(CSS);

  it("meets the WCAG contrast rules", () => {
    expectContrast(RARITIES, CARD_SURFACES, 4.5, tokens);
    expectContrast(["--text-primary"], SURFACES, 7, tokens);
    expectContrast(["--text-secondary"], SURFACES, 4.5, tokens);
    expectContrast(["--text-disabled"], SURFACES, 3, tokens);
    expectContrast(TYPES, ["--surface-card"], 3, tokens);

    const backing = color("--icon-backing", tokens);
    for (const type of TYPES) {
      for (const action of ACTIONS) {
        expect(
          contrastRatio(color(action, tokens), backing),
          `${type} / ${action} icon on --icon-backing`,
        ).toBeGreaterThanOrEqual(3);
      }
    }

    expect(
      contrastRatio(color("--border-selected", tokens), color("--surface-card", tokens)),
      "--border-selected on --surface-card",
    ).toBeGreaterThanOrEqual(3);
  });

  it("keeps confusing neighbours visibly separated in OKLab", () => {
    const namedPairs = [
      ["--mod-solar", "--action-strike"],
      ["--mod-arc", "--rarity-uncommon"],
      ["--mod-void", "--rarity-super-rare"],
      ["--action-tech", "--rarity-legendary"],
      ["--mod-solar", "--rarity-legendary"],
      ["--action-block", "--rarity-rare"],
      ["--mod-neutral", "--surface-card"],
    ] as const;
    for (const [first, second] of namedPairs) expectSeparated(first, second, tokens);

    for (let first = 0; first < TYPES.length; first++) {
      for (let second = first + 1; second < TYPES.length; second++) {
        expectSeparated(TYPES[first], TYPES[second], tokens);
      }
    }

    expectSeparated("--text-secondary", "--text-disabled", tokens);
    expectSeparated("--border-selected", "--border-subtle", tokens);
  });


  it("keeps action and status glyphs on semantic colour tokens", () => {
    expect(CSS).toContain(".icon__outline { stroke: var(--icon-outline); }");

    for (const name of ["strike", "tech", "block", "burn", "shock", "poison"]) {
      const match = ICON_SOURCE.match(new RegExp(`\\b${name}: glyph\\(\\\`([\\s\\S]*?)\\\`\\),`));
      expect(match, `missing ${name} glyph`).not.toBeNull();
      const body = match![1];
      expect(body, `${name} fill`).toContain('fill="currentColor"');
      expect(body, `${name} outline`).toContain('class="icon__outline"');
      expect(body, `${name} literal colour`).not.toMatch(/#[0-9a-f]{3,8}\\b|rgb\\([^)]*\\)|hsl\\([^)]*\\)/i);
      expect(body, `${name} legacy ink outline`).not.toContain("${INK}");
    }
  });

  it("allows no new literal colours in mod UI rules", () => {
    const violations: string[] = [];
    const allowedSeen = new Set<string>();
    const rule = /([^{}]+)\{([^{}]*)\}/g;

    for (const match of withoutRoot(CSS).matchAll(rule)) {
      const selector = match[1].replace(/\s+/g, " ").trim();
      if (!isModRule(selector)) continue;

      for (const literal of match[2].matchAll(/#[0-9a-f]{3,8}\b|rgb\([^)]*\)|hsl\([^)]*\)/gi)) {
        const key = `${selector}|${literal[0].toLowerCase()}`;
        if (LITERAL_ALLOWLIST.has(key)) allowedSeen.add(key);
        else violations.push(key);
      }
    }

    expect(violations).toEqual([]);
    expect([...allowedSeen].sort(), "remove stale allowlist entries as tasks-020/021 tokenise them")
      .toEqual([...LITERAL_ALLOWLIST].sort());
  });
});
