import { describe, expect, it } from "vitest";

import { BASE_CHARGE_CAPACITY } from "../../src/mods/balance.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid } from "../../src/mods/grid.ts";
import { REGISTRY } from "../../src/mods/registry.ts";
import type { ModId } from "../../src/mods/registry.ts";
import type { Rotation } from "../../src/mods/shapes.ts";
import type { Stars } from "../../src/mods/stars.ts";

let uid = 0;
/** Places each piece in order; every one of them must be legal. */
function grid(...pieces: ReadonlyArray<readonly [ModId, number, number, Rotation?, Stars?]>): Grid {
  let built: Grid = [];
  for (const [mod, x, y, rotation = 0, stars = 1] of pieces) {
    const next = place(built, { uid: ++uid, mod, stars, rotation, x, y });
    if (next === null) throw new Error(`${mod} does not fit at ${x},${y}`);
    built = next;
  }
  return built;
}

describe("compiling a grid", () => {
  it("adds nothing for an empty grid", () => {
    expect(compileBuild([])).toEqual({
      lanes: { strike: 0, tech: 0, block: 0 },
      attuned: { strike: null, tech: null, block: null },
      program: { mods: [] },
      capacity: BASE_CHARGE_CAPACITY,
      income: 0,
      freeRerolls: 0,
      styleMultiplier: 1,
    });
  });

  it("powers the action of the row an elemental cell sits in by one", () => {
    expect(compileBuild(grid(["heat-coil", 0, 0])).lanes).toEqual({ strike: 1, tech: 0, block: 0 });
    expect(compileBuild(grid(["void-tap", 2, 1])).lanes).toEqual({ strike: 0, tech: 1, block: 0 });
    expect(compileBuild(grid(["arc-dynamo", 1, 2])).lanes).toEqual({ strike: 0, tech: 0, block: 1 });
    // Standing up across all three rows, a three-cell piece is +1 to each.
    expect(compileBuild(grid(["chain-circuit", 0, 0, 1])).lanes).toEqual({ strike: 1, tech: 1, block: 1 });
  });

  it("attunes a row whose three cells share one type, at two per cell", () => {
    const attuned = compileBuild(grid(["chain-circuit", 0, 0]));
    expect(attuned.lanes.strike).toBe(6);
    expect(attuned.attuned).toEqual({ strike: "arc", tech: null, block: null });
    const mixed = compileBuild(grid(["heat-coil", 0, 1], ["void-tap", 1, 1], ["arc-dynamo", 2, 1]));
    expect(mixed.lanes.tech).toBe(3);
    expect(mixed.attuned.tech).toBeNull();
    // Heat Death is now Void only; a Solar Heat Coil no longer completes an attuned row.
    const bridged = compileBuild(grid(["heat-death", 0, 1], ["heat-coil", 2, 2]));
    expect(bridged.attuned.block).toBeNull();
    expect(bridged.lanes.block).toBe(3);
    expect(compileBuild(grid(["furnace", 0, 0])).lanes.strike).toBe(2);
  });

  it("gives Neutral cells no power, and lets them break a row", () => {
    const broken = compileBuild(grid(["heat-coil", 0, 0], ["piggy-bank", 1, 0], ["heat-coil", 2, 0]));
    expect(broken.lanes.strike).toBe(2);
    expect(broken.attuned.strike).toBeNull();
    expect(compileBuild(grid(["piggy-bank", 0, 0], ["coupon", 1, 0], ["amplifier", 2, 0])).lanes.strike).toBe(0);
  });

  it("lets an Amplifier add its stars' worth to each elemental cell of every mod touching it", () => {
    // Furnace along the top touches the Amplifier below its right cell; the Heat Coil in the corner does not.
    expect(compileBuild(grid(["furnace", 0, 0], ["amplifier", 1, 1], ["heat-coil", 2, 2])).lanes).toEqual({ strike: 4, tech: 0, block: 1 });
    expect(compileBuild(grid(["heat-coil", 1, 1], ["amplifier", 0, 1], ["amplifier", 2, 1])).lanes.tech).toBe(3);
    expect(compileBuild(grid(["heat-coil", 1, 1], ["amplifier", 0, 1, 0, 3])).lanes.tech).toBe(1 + 3);
  });

  it("hands the engine every placed mod at its stars, with the links its ports make where it stands", () => {
    const build = compileBuild(grid(["heat-coil", 0, 0], ["cinder-edge", 1, 0, 0, 2], ["battery-cell", 0, 2, 0, 2]));
    expect(build.program.mods.map((mod) => [mod.definition, mod.stars])).toEqual([
      [REGISTRY["heat-coil"], 1], [REGISTRY["cinder-edge"], 2], [REGISTRY["battery-cell"], 2],
    ]);
    expect(build.program.mods[0].feeds).toEqual(["heat"]);
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

  it("returns lanes, the engine's program and money: nothing that could describe timing or a bar", () => {
    const build = compileBuild(grid(["solar-flare", 0, 0], ["storm-cell", 0, 2]));
    expect(Object.keys(build).sort()).toEqual(["attuned", "capacity", "freeRerolls", "income", "lanes", "program", "styleMultiplier"]);
  });
});
