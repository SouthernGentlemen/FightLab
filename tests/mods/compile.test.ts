import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { BASE_CHARGE_CAPACITY } from "../../src/mods/balance.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { capacity, generate } from "../../src/mods/effects.ts";
import type { Effect, ModEffect } from "../../src/mods/effects.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid } from "../../src/mods/grid.ts";
import type { ModDefinition } from "../../src/mods/registry.ts";
import type { Rotation } from "../../src/mods/shapes.ts";
import type { Stars } from "../../src/mods/stars.ts";
import type { ModType } from "../../src/mods/tags.ts";
import { pick, placement } from "./fixtures.ts";

const SOLAR_SINGLE = pick({ type: "solar", size: 1 });
const ARC_SINGLE = pick({ type: "arc", size: 1 });
const VOID_SINGLE = pick({ type: "void", size: 1 });
const DOMINO = pick({ type: "solar", affinity: "strike", size: 2 });
const NEUTRAL_SINGLE = pick({ type: "neutral", size: 1 });

let uid = 0;

function grid(...pieces: ReadonlyArray<readonly [ModDefinition, number, number, Rotation?, Stars?]>): Grid {
  let built: Grid = [];
  for (const [definition, x, y, rotation = 0, stars = 1] of pieces) {
    const next = place(built, { uid: ++uid, stars, ...placement([definition, x, y, rotation]) });
    if (next === null) throw new Error(`${definition.id} does not fit at ${x},${y}`);
    built = next;
  }
  return built;
}

function definition(
  base: ModDefinition,
  type: ModType,
  affinity: ActionType | null,
  effect: ModEffect,
): ModDefinition {
  return { ...base, type, affinity, effects: [], effect };
}

function legacy(base: ModDefinition, effects: readonly Effect[]): ModDefinition {
  return { ...base, effects, effect: undefined };
}

describe("compiling a grid", () => {
  it("adds nothing for an empty grid", () => {
    expect(compileBuild([])).toEqual({
      program: { mods: [] },
      preview: { strike: 0, tech: 0, block: 0 },
      capacity: BASE_CHARGE_CAPACITY,
      income: 0,
      freeRerolls: 0,
      styleMultiplier: 1,
    });
  });

  it("previews unconditional new-vocabulary damage by affinity", () => {
    const strike = definition(SOLAR_SINGLE, "solar", "strike", {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [2, 3, 4], per: "flat" } }],
    });
    const every = definition(ARC_SINGLE, "arc", null, {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [1, 2, 3], per: "flat" } }],
    });
    const built = compileBuild(
      grid([strike, 0, 0, 0, 2], [every, 2, 2, 0, 1]),
      { [strike.id]: strike, [every.id]: every },
    );
    expect(built.preview).toEqual({ strike: 4, tech: 1, block: 1 });
  });

  it("evaluates static board scales, adjacency conditions and received boosts", () => {
    const target = definition(DOMINO, "solar", "strike", {
      kind: "exchange",
      when: { kind: "adjacent-to", type: "neutral" },
      payoffs: [{ kind: "damage", amount: { value: [1, 1, 1], per: "cell" } }],
    });
    const booster = definition(NEUTRAL_SINGLE, "neutral", null, {
      kind: "boost",
      amount: [1, 2, 3],
      to: "adjacent",
    });
    const built = compileBuild(
      grid([target, 0, 0], [booster, 0, 1, 0, 2]),
      { [target.id]: target, [booster.id]: booster },
    );
    expect(built.preview).toEqual({ strike: 6, tech: 0, block: 0 });
    expect(built.program.mods.find((mod) => mod.definition.id === target.id)!.adjacent).toHaveLength(1);
  });

  it("excludes opponent-state conditions and status-scaled damage from static preview", () => {
    const conditional = definition(SOLAR_SINGLE, "solar", "strike", {
      kind: "exchange",
      when: { kind: "opponent-has", status: "burn" },
      payoffs: [{ kind: "damage", amount: { value: [5, 6, 7], per: "flat" } }],
    });
    const statusScaled = definition(ARC_SINGLE, "arc", "tech", {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [4, 5, 6], per: "shock" } }],
    });
    expect(compileBuild(
      grid([conditional, 0, 0], [statusScaled, 2, 2]),
      { [conditional.id]: conditional, [statusScaled.id]: statusScaled },
    ).preview).toEqual({ strike: 0, tech: 0, block: 0 });
  });

  it("counts every old-kind catalogue effect as zero preview damage", () => {
    const first = legacy(SOLAR_SINGLE, [generate("heat", [1, 2, 3])]);
    const second = legacy(ARC_SINGLE, [generate("charge", [1, 2, 3])]);
    expect(compileBuild(
      grid([first, 0, 0], [second, 0, 2]),
      { [first.id]: first, [second.id]: second },
    ).preview).toEqual({ strike: 0, tech: 0, block: 0 });
  });

  it("hands the engine every placed mod at its stars with adjacency facts", () => {
    const first = legacy(SOLAR_SINGLE, []);
    const adjacent = legacy(DOMINO, []);
    const stored = legacy(ARC_SINGLE, [capacity([2, 3, 5])]);
    const build = compileBuild(
      grid([first, 0, 0], [adjacent, 1, 0, 0, 2], [stored, 0, 2, 0, 2]),
      { [first.id]: first, [adjacent.id]: adjacent, [stored.id]: stored },
    );
    expect(build.program.mods.map((mod) => [mod.definition, mod.stars])).toEqual([
      [first, 1],
      [adjacent, 2],
      [stored, 2],
    ]);
    expect(build.program.mods[0].adjacent).toEqual([build.program.mods[1].uid]);
    expect(build.capacity).toBe(BASE_CHARGE_CAPACITY + 3);
  });

  it("pays synthetic run perks by their stars", () => {
    const income = definition(SOLAR_SINGLE, "neutral", null, { kind: "perk", perk: "income", amount: [1, 2, 3] });
    const reroll = definition(ARC_SINGLE, "neutral", null, { kind: "perk", perk: "free-reroll", amount: [1, 2, 3] });
    const style = definition(VOID_SINGLE, "neutral", null, { kind: "perk", perk: "style", amount: [1, 2, 3] });
    const definitions = { [income.id]: income, [reroll.id]: reroll, [style.id]: style };

    expect(compileBuild(grid([income, 0, 0], [income, 1, 0]), definitions).income).toBe(2);
    expect(compileBuild(grid([income, 0, 0, 0, 3]), definitions).income).toBe(3);
    expect(compileBuild(grid([reroll, 0, 0]), definitions).freeRerolls).toBe(1);
    expect(compileBuild(grid([style, 0, 0]), definitions).styleMultiplier).toBe(2);
    expect(compileBuild(grid([style, 0, 0], [style, 0, 1]), definitions).styleMultiplier).toBe(3);
    expect(compileBuild(grid([style, 0, 0, 0, 2]), definitions).styleMultiplier).toBe(3);
  });

  it("returns preview, the engine program and run values with no row-lane state", () => {
    expect(Object.keys(compileBuild([])).sort()).toEqual([
      "capacity", "freeRerolls", "income", "preview", "program", "styleMultiplier",
    ]);
  });
});
