import { describe, expect, it } from "vitest";

import { boardPorts, links, turnSide } from "../../src/mods/ports.ts";
import type { Port, PortedPiece } from "../../src/mods/ports.ts";
import { RARITIES, RARITY, rarityLine } from "../../src/mods/rarity.ts";
import { RECIPES, STARS, bestStars, combineAll, copiesIn, recipeFor, scaled } from "../../src/mods/stars.ts";
import { AFFINITY_LABEL, MOD_TYPES, TYPE_LABEL, isModType } from "../../src/mods/tags.ts";
import { ROTATIONS } from "../../src/mods/shapes.ts";

describe("mod type and affinity", () => {
  it("defines the four mod types and their labels", () => {
    expect(MOD_TYPES).toEqual(["solar", "arc", "void", "neutral"]);
    for (const type of MOD_TYPES) expect(isModType(type), type).toBe(true);
    expect(isModType("strike")).toBe(false);
    expect(isModType("fire")).toBe(false);
    expect(TYPE_LABEL).toEqual({ solar: "Solar", arc: "Arc", void: "Void", neutral: "Neutral" });
  });

  it("labels the optional action affinity independently of type", () => {
    expect(AFFINITY_LABEL).toEqual({ strike: "Strike", tech: "Tech", block: "Block" });
  });
});

describe("rarity", () => {
  it("is five materials from Iron to Diamond, each dearer than the last", () => {
    expect(RARITIES.map((rarity) => RARITY[rarity].material)).toEqual(["iron", "bronze", "silver", "gold", "diamond"]);
    expect(RARITIES.map((rarity) => RARITY[rarity].price)).toEqual([3, 4, 5, 7, 8]);
    expect(rarityLine("rare")).toBe("RARE · SILVER");
    expect(rarityLine("super-rare")).toBe("SUPER RARE · GOLD");
  });
});

describe("stars", () => {
  it("combine three ★ into ★★ and two ★★ into ★★★, and nothing else", () => {
    expect(RECIPES).toEqual([{ from: 1, count: 3, to: 2 }, { from: 2, count: 2, to: 3 }]);
    expect(recipeFor(1)).toBeNull();
    expect(STARS.map(copiesIn)).toEqual([1, 3, 6]);
  });

  it("make one ★★★ from six ★ copies, and never lose or invent a copy", () => {
    expect(combineAll({ 1: 6, 2: 0, 3: 0 })).toEqual({ 1: 0, 2: 0, 3: 1 });
    expect(combineAll({ 1: 5, 2: 0, 3: 0 })).toEqual({ 1: 2, 2: 1, 3: 0 });
    expect(combineAll({ 1: 3, 2: 1, 3: 0 })).toEqual({ 1: 0, 2: 0, 3: 1 });
    for (let ones = 0; ones <= 20; ones++) {
      const after = combineAll({ 1: ones, 2: 0, 3: 0 });
      expect(STARS.reduce((sum, stars) => sum + after[stars] * copiesIn(stars), 0)).toBe(ones);
      expect(after[1]).toBeLessThan(3);
      expect(after[2]).toBeLessThan(2);
    }
  });

  it("say the highest level a number of copies can make", () => {
    expect([0, 1, 2, 3, 5, 6, 11].map(bestStars)).toEqual([1, 1, 1, 2, 2, 3, 3]);
  });

  it("read a scaled number at each level, independent of rarity", () => {
    expect(STARS.map((stars) => scaled([2, 3, 5], stars))).toEqual([2, 3, 5]);
  });
});

describe("ports", () => {
  const piece = (uid: number, ports: readonly Port[], x: number, y: number, rotation: 0 | 1 | 2 | 3 = 0, shape: PortedPiece["shape"] = "mono"): PortedPiece =>
    ({ uid, shape, rotation, x, y, ports });
  const heatOut: Port = { cell: 0, side: "e", flow: "out", resource: "heat" };
  const heatIn: Port = { cell: 0, side: "w", flow: "in", resource: "heat" };

  it("turn clockwise with the piece and come back after four turns", () => {
    expect(ROTATIONS.map((rotation) => turnSide("n", rotation))).toEqual(["n", "e", "s", "w"]);
    // A duo standing up carries its right-hand cell underneath, facing down.
    expect(boardPorts(piece(1, [{ ...heatOut, cell: 1 }], 0, 0, 1, "duo"))).toEqual([{ uid: 1, at: [0, 1], side: "s", flow: "out", resource: "heat" }]);
    expect(boardPorts(piece(1, [heatOut], 1, 1, 0))).toEqual(boardPorts(piece(1, [heatOut], 1, 1, 0)));
  });

  it("link an out-port to a matching in-port across a shared edge", () => {
    expect(links([piece(1, [heatOut], 0, 0), piece(2, [heatIn], 1, 0)])).toEqual([{ from: 1, to: 2, resource: "heat" }]);
  });

  it("stop linking when either piece turns away, or the resources differ, or the cells do not touch", () => {
    expect(links([piece(1, [heatOut], 0, 0, 2), piece(2, [heatIn], 1, 0)])).toEqual([]);
    expect(links([piece(1, [heatOut], 0, 0), piece(2, [heatIn], 1, 0, 1)])).toEqual([]);
    expect(links([piece(1, [heatOut], 0, 0), piece(2, [{ ...heatIn, resource: "charge" }], 1, 0)])).toEqual([]);
    expect(links([piece(1, [heatOut], 0, 0), piece(2, [heatIn], 2, 0)])).toEqual([]);
  });

  it("link again when the turn points the port at a neighbour: rotation is behaviour, not decoration", () => {
    // The producer sits above the consumer; facing east it misses, turned a quarter it faces south.
    const consumer = piece(2, [{ ...heatIn, side: "n" }], 0, 1);
    expect(links([piece(1, [heatOut], 0, 0, 0), consumer])).toEqual([]);
    expect(links([piece(1, [heatOut], 0, 0, 1), consumer])).toEqual([{ from: 1, to: 2, resource: "heat" }]);
  });
});
