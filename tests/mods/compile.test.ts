import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { CATALOG, ELEMENTS, MOD_AFFINITIES, MOD_IDS, TIERS } from "../../src/mods/catalog.ts";
import type { ModId } from "../../src/mods/catalog.ts";
import { ARC_SURGE_PER_LEVEL, SOLAR_DAMAGE_PER_LEVEL, VOID_HEALTH_PER_LEVEL, compileBuild } from "../../src/mods/compile.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid, PlacedMod } from "../../src/mods/grid.ts";
import { SHAPES } from "../../src/mods/shapes.ts";
import type { Rotation } from "../../src/mods/shapes.ts";

let uid = 0;
/** Places each piece in order; every one of them must be legal. */
function grid(...pieces: ReadonlyArray<readonly [ModId, number, number, Rotation?]>): Grid {
  let built: Grid = [];
  for (const [mod, x, y, rotation = 0] of pieces) {
    const next = place(built, { uid: ++uid, mod, rotation, x, y } satisfies PlacedMod);
    if (next === null) throw new Error(`${mod} does not fit at ${x},${y}`);
    built = next;
  }
  return built;
}

describe("the catalogue", () => {
  it("is sixteen mods, four of each affinity", () => {
    expect(MOD_IDS).toHaveLength(16);
    expect(new Set(MOD_IDS).size).toBe(16);
    for (const affinity of MOD_AFFINITIES) expect(MOD_IDS.filter((id) => CATALOG[id].affinity === affinity), affinity).toHaveLength(4);
  });

  it("gives every mod a known shape, a tier, a price in its tier's band and a perk described in words", () => {
    const bands: Record<number, [number, number]> = { 1: [3, 4], 2: [4, 5], 3: [7, 7], 4: [8, 8] };
    for (const id of MOD_IDS) {
      const mod = CATALOG[id];
      expect(mod.id).toBe(id);
      expect(Object.keys(SHAPES)).toContain(mod.shape);
      expect(TIERS).toContain(mod.tier);
      expect(mod.price, id).toBeGreaterThanOrEqual(bands[mod.tier][0]);
      expect(mod.price, id).toBeLessThanOrEqual(bands[mod.tier][1]);
      expect(mod.perk === null, id).toBe(mod.text === "");
      expect(Object.isFrozen(mod)).toBe(true);
    }
  });

  it("offers every tier at least one mod", () => {
    for (const tier of TIERS) expect(MOD_IDS.some((id) => CATALOG[id].tier === tier), `tier ${tier}`).toBe(true);
  });
});

describe("compiling a grid", () => {
  it("adds nothing for an empty grid", () => {
    expect(compileBuild([])).toEqual({
      lanes: { strike: 0, tech: 0, block: 0 },
      attuned: { strike: null, tech: null, block: null },
      cells: { solar: 0, void: 0, arc: 0 },
      levels: { solar: 0, void: 0, arc: 0 },
      damage: { strike: 0, tech: 0, block: 0 },
      surge: 0,
      health: 0,
      parryHeal: 0,
      income: 0,
      freeRerolls: 0,
      styleMultiplier: 1,
    });
  });

  it("powers the action of the row a cell sits in by one", () => {
    expect(compileBuild(grid(["ember", 0, 0])).lanes).toEqual({ strike: 1, tech: 0, block: 0 });
    expect(compileBuild(grid(["shade", 2, 1])).lanes).toEqual({ strike: 0, tech: 1, block: 0 });
    expect(compileBuild(grid(["spark", 1, 2])).lanes).toEqual({ strike: 0, tech: 0, block: 1 });
    // Standing up across all three rows, a three-cell piece is +1 to each.
    expect(compileBuild(grid(["static", 0, 0, 1])).lanes).toEqual({ strike: 1, tech: 1, block: 1 });
  });

  it("attunes a row whose three cells share one element, at two per cell", () => {
    const attuned = compileBuild(grid(["static", 0, 0]));
    expect(attuned.lanes.strike).toBe(6);
    expect(attuned.attuned).toEqual({ strike: "arc", tech: null, block: null });
    const mixed = compileBuild(grid(["ember", 0, 1], ["shade", 1, 1], ["spark", 2, 1]));
    expect(mixed.lanes.tech).toBe(3);
    expect(mixed.attuned.tech).toBeNull();
    const pieces = compileBuild(grid(["sunburst", 0, 2], ["ember", 2, 2]));
    expect(pieces.lanes.block).toBe(6);
    expect(pieces.attuned.block).toBe("solar");
    // Two cells of one element is not a row.
    expect(compileBuild(grid(["sunburst", 0, 0])).lanes.strike).toBe(2);
  });

  it("gives neutral cells no power, and lets them break a row", () => {
    const broken = compileBuild(grid(["ember", 0, 0], ["piggy-bank", 1, 0], ["ember", 2, 0]));
    expect(broken.lanes.strike).toBe(2);
    expect(broken.attuned.strike).toBeNull();
    expect(compileBuild(grid(["piggy-bank", 0, 0], ["coupon", 1, 0], ["overclock", 2, 0])).lanes.strike).toBe(0);
  });

  it("lets Overclock add one to each element cell of every mod touching it", () => {
    // Sunburst at (0,0)-(1,0) touches Overclock at (1,1); Ember at (2,2) does not.
    const build = compileBuild(grid(["sunburst", 0, 0], ["overclock", 1, 1], ["ember", 2, 2]));
    expect(build.lanes).toEqual({ strike: 4, tech: 0, block: 1 });
    // Two Overclocks touching one mod add two.
    const twice = compileBuild(grid(["ember", 1, 1], ["overclock", 0, 1], ["overclock", 2, 1]));
    expect(twice.lanes.tech).toBe(3);
    // An attuned row still gets it.
    const row = compileBuild(grid(["static", 0, 0], ["overclock", 1, 1]));
    expect(row.lanes.strike).toBe(3 * (2 + 1));
  });

  it("counts a level for every three cells of an element, up to three", () => {
    const counts = (built: Grid) => compileBuild(built);
    expect(counts(grid(["sunburst", 0, 0])).levels.solar).toBe(0);
    expect(counts(grid(["sunburst", 0, 0], ["ember", 2, 0])).levels.solar).toBe(1);
    const six = counts(grid(["corona", 0, 0], ["sunburst", 0, 2]));
    expect(six.cells.solar).toBe(6);
    expect(six.levels.solar).toBe(2);
    const nine = counts(grid(["static", 0, 0], ["static", 0, 1], ["static", 0, 2]));
    expect(nine.cells.arc).toBe(9);
    expect(nine.levels.arc).toBe(3);
    for (const element of ELEMENTS) expect(counts([]).levels[element]).toBe(0);
  });

  it("turns Solar levels into damage on every action, Void into health and Arc into surge", () => {
    const solar = compileBuild(grid(["sunburst", 0, 1], ["ember", 2, 1]));
    for (const action of ACTION_TYPES) {
      expect(solar.damage[action]).toBe(solar.lanes[action] + SOLAR_DAMAGE_PER_LEVEL);
    }
    expect(compileBuild(grid(["nightfall", 0, 0], ["shade", 2, 0], ["nightfall", 0, 1], ["shade", 2, 1])).health).toBe(2 * VOID_HEALTH_PER_LEVEL);
    expect(compileBuild(grid(["coil", 0, 0], ["spark", 2, 0])).surge).toBe(ARC_SURGE_PER_LEVEL);
  });

  it("applies each perk to the number it names and nothing else", () => {
    const flare = compileBuild(grid(["flare", 0, 1]));
    expect(flare.damage).toEqual({ strike: flare.lanes.strike + 1 + 2, tech: flare.lanes.tech + 1, block: flare.lanes.block + 1 });
    // Arc levels only ever surge, so an attuned Arc row adds its lane and Static its overhead.
    const staticRow = compileBuild(grid(["static", 0, 2]));
    expect(staticRow.damage).toEqual({ strike: 0, tech: 2, block: 6 });
    const horizon = compileBuild(grid(["event-horizon", 1, 1]));
    expect(horizon.damage.block - horizon.lanes.block).toBe(5);
    expect(horizon.health).toBe(VOID_HEALTH_PER_LEVEL);
    const corona = compileBuild(grid(["corona", 0, 0]));
    for (const action of ACTION_TYPES) expect(corona.damage[action]).toBe(corona.lanes[action] + 1 + 2);
    expect(compileBuild(grid(["thunderclap", 0, 0])).surge).toBe(ARC_SURGE_PER_LEVEL + 3);
    expect(compileBuild(grid(["eclipse", 0, 0])).parryHeal).toBe(5);
    expect(compileBuild(grid(["piggy-bank", 0, 0], ["piggy-bank", 1, 0])).income).toBe(2);
    expect(compileBuild(grid(["coupon", 0, 0])).freeRerolls).toBe(1);
    expect(compileBuild(grid(["crowd-pleaser", 0, 0])).styleMultiplier).toBe(2);
    expect(compileBuild(grid(["crowd-pleaser", 0, 0], ["crowd-pleaser", 0, 1])).styleMultiplier).toBe(3);
  });

  it("returns only damage, health, healing and money: nothing that could describe timing or a bar", () => {
    const build = compileBuild(grid(["corona", 0, 0], ["thunderclap", 0, 1]));
    expect(Object.keys(build).sort()).toEqual(
      ["attuned", "cells", "damage", "freeRerolls", "health", "income", "lanes", "levels", "parryHeal", "styleMultiplier", "surge"],
    );
  });
});
