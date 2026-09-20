import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { BASE_CHARGE_CAPACITY } from "../../src/mods/balance.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import type { ModEffect } from "../../src/mods/effects.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid } from "../../src/mods/grid.ts";
import { REGISTRY } from "../../src/mods/registry.ts";
import type { ModDefinition, ModId } from "../../src/mods/registry.ts";
import type { Rotation } from "../../src/mods/shapes.ts";
import type { Stars } from "../../src/mods/stars.ts";
import type { ModType } from "../../src/mods/tags.ts";

let uid = 0;

function grid(...pieces: ReadonlyArray<readonly [ModId, number, number, Rotation?, Stars?]>): Grid {
  let built: Grid = [];
  for (const [mod, x, y, rotation = 0, stars = 1] of pieces) {
    const next = place(built, { uid: ++uid, mod, stars, rotation, x, y });
    if (next === null) throw new Error(`${mod} does not fit at ${x},${y}`);
    built = next;
  }
  return built;
}

function definition(
  id: ModId,
  type: ModType,
  affinity: ActionType | null,
  effect: ModEffect,
): ModDefinition {
  return { ...REGISTRY[id], type, affinity, effects: [], effect };
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
    const strike = definition("heat-coil", "solar", "strike", {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [2, 3, 4], per: "flat" } }],
    });
    const every = definition("arc-dynamo", "arc", null, {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [1, 2, 3], per: "flat" } }],
    });
    const built = compileBuild(
      grid(["heat-coil", 0, 0, 0, 2], ["arc-dynamo", 2, 2, 0, 1]),
      { "heat-coil": strike, "arc-dynamo": every },
    );
    expect(built.preview).toEqual({ strike: 4, tech: 1, block: 1 });
  });

  it("evaluates static board scales, adjacency conditions and received boosts", () => {
    const target = definition("cinder-edge", "solar", "strike", {
      kind: "exchange",
      when: { kind: "adjacent-to", type: "neutral" },
      payoffs: [{ kind: "damage", amount: { value: [1, 1, 1], per: "cell" } }],
    });
    const amplifier = REGISTRY.amplifier;
    const built = compileBuild(
      grid(["cinder-edge", 0, 0], ["amplifier", 0, 1, 0, 2]),
      { "cinder-edge": target, amplifier },
    );
    // Domino: (1 base + 2 received boost) × 2 cells.
    expect(built.preview).toEqual({ strike: 6, tech: 0, block: 0 });
    expect(built.program.mods.find((mod) => mod.definition.id === "cinder-edge")!.adjacent).toHaveLength(1);
  });

  it("excludes opponent-state conditions and status-scaled damage from static preview", () => {
    const conditional = definition("heat-coil", "solar", "strike", {
      kind: "exchange",
      when: { kind: "opponent-has", status: "burn" },
      payoffs: [{ kind: "damage", amount: { value: [5, 6, 7], per: "flat" } }],
    });
    const statusScaled = definition("arc-dynamo", "arc", "tech", {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [4, 5, 6], per: "shock" } }],
    });
    expect(compileBuild(
      grid(["heat-coil", 0, 0], ["arc-dynamo", 2, 2]),
      { "heat-coil": conditional, "arc-dynamo": statusScaled },
    ).preview).toEqual({ strike: 0, tech: 0, block: 0 });
  });

  it("counts every old-kind catalogue mod as zero preview damage", () => {
    expect(compileBuild(grid(
      ["solar-flare", 0, 0],
      ["storm-cell", 0, 2],
    )).preview).toEqual({ strike: 0, tech: 0, block: 0 });
  });

  it("hands the engine every placed mod at its stars with adjacency facts", () => {
    const build = compileBuild(grid(
      ["heat-coil", 0, 0],
      ["cinder-edge", 1, 0, 0, 2],
      ["battery-cell", 0, 2, 0, 2],
    ));
    expect(build.program.mods.map((mod) => [mod.definition, mod.stars])).toEqual([
      [REGISTRY["heat-coil"], 1],
      [REGISTRY["cinder-edge"], 2],
      [REGISTRY["battery-cell"], 2],
    ]);
    expect(build.program.mods[0].adjacent).toEqual([build.program.mods[1].uid]);
    expect(build.capacity).toBe(BASE_CHARGE_CAPACITY + 3);
  });

  it("pays the run perks by their stars", () => {
    expect(compileBuild(grid(["piggy-bank", 0, 0], ["piggy-bank", 1, 0])).income).toBe(2);
    expect(compileBuild(grid(["piggy-bank", 0, 0, 0, 3])).income).toBe(3);
    expect(compileBuild(grid(["coupon", 0, 0])).freeRerolls).toBe(1);
    expect(compileBuild(grid(["crowd-pleaser", 0, 0])).styleMultiplier).toBe(2);
    expect(compileBuild(grid(["crowd-pleaser", 0, 0], ["crowd-pleaser", 0, 1])).styleMultiplier).toBe(3);
    expect(compileBuild(grid(["crowd-pleaser", 0, 0, 0, 2])).styleMultiplier).toBe(3);
  });

  it("returns preview, the engine program and run values with no row-lane state", () => {
    expect(Object.keys(compileBuild([])).sort()).toEqual([
      "capacity", "freeRerolls", "income", "preview", "program", "styleMultiplier",
    ]);
  });
});
