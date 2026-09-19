import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { EVERYTHING, armoryList, collected } from "../../src/mods/armory.ts";
import type { Owned } from "../../src/mods/armory.ts";
import { place } from "../../src/mods/grid.ts";
import { RARITIES } from "../../src/mods/rarity.ts";
import { DEFINITIONS, MOD_IDS, REGISTRY } from "../../src/mods/registry.ts";
import { MOD_TYPES } from "../../src/mods/tags.ts";
import { DEV_MAX_COPIES, seededCollection } from "../../src/run/collection.ts";

const NONE: Owned = () => 0;
const names = (list: ReturnType<typeof armoryList>) => list.map((definition) => definition.name);

describe("the Armory's catalogue", () => {
  it("lists every registered mod, in registry order, as the very records combat runs on", () => {
    const listed = armoryList(EVERYTHING, NONE);
    expect(listed.map((definition) => definition.id)).toEqual([...MOD_IDS]);
    listed.forEach((definition, index) => expect(definition).toBe(REGISTRY[MOD_IDS[index]]));
    // A compiled grid hands the engine the same object the Armory shows.
    const build = compileBuild(place([], { uid: 1, mod: "cinder-edge", stars: 2, rotation: 0, x: 0, y: 0 })!);
    expect(build.program.mods[0].definition).toBe(listed.find((definition) => definition.id === "cinder-edge"));
  });

  it("filters by type and affinity", () => {
    for (const type of MOD_TYPES) {
      const listed = armoryList({ ...EVERYTHING, type }, NONE);
      expect(listed.length, type).toBeGreaterThan(0);
      expect(listed.every((definition) => definition.type === type), type).toBe(true);
    }
    expect(names(armoryList({ ...EVERYTHING, type: "solar" }, NONE))).not.toContain("Heat Death");
    expect(names(armoryList({ ...EVERYTHING, type: "void" }, NONE))).toContain("Heat Death");
    expect(names(armoryList({ ...EVERYTHING, type: "neutral" }, NONE))).toEqual(["Piggy Bank", "Coupon", "Crowd Pleaser", "Amplifier"]);
    for (const affinity of ACTION_TYPES) {
      expect(armoryList({ ...EVERYTHING, affinity }, NONE).every((definition) => definition.affinity === affinity), affinity).toBe(true);
    }
    expect(names(armoryList({ ...EVERYTHING, type: "solar", affinity: "strike" }, NONE))).toEqual(["Cinder Edge", "Afterburner", "Solar Flare"]);
  });

  it("filters by rarity, by ownership and by text", () => {
    for (const rarity of RARITIES) expect(armoryList({ ...EVERYTHING, rarity }, NONE).every((definition) => definition.rarity === rarity)).toBe(true);
    expect(armoryList({ ...EVERYTHING, rarity: "legendary" }, NONE)).toHaveLength(6);
    const owned: Owned = (mod) => (mod === "furnace" || mod === "coupon" ? 2 : 0);
    expect(names(armoryList({ ...EVERYTHING, ownedOnly: true }, owned))).toEqual(["Furnace", "Coupon"]);
    expect(names(armoryList({ ...EVERYTHING, text: "cinder" }, NONE))).toEqual(["Cinder Edge"]);
    expect(armoryList({ ...EVERYTHING, text: "SILVER" }, NONE).every((definition) => definition.rarity === "rare")).toBe(true);
    expect(names(armoryList({ ...EVERYTHING, text: "void / tech" }, NONE))).toEqual(["Event Horizon", "Singularity"]);
    expect(armoryList({ ...EVERYTHING, text: "nothing like this" }, NONE)).toEqual([]);
  });

  it("counts how much of the catalogue is collected", () => {
    expect(collected(NONE)).toEqual({ owned: 0, total: DEFINITIONS.length });
    expect(collected((mod) => (mod === "heat-coil" ? 6 : 0))).toEqual({ owned: 1, total: DEFINITIONS.length });
  });
});

describe("the development collection", () => {
  it("is deterministic, bounded and behind the repository interface", () => {
    const first = seededCollection();
    const again = seededCollection();
    for (const id of MOD_IDS) {
      expect(first.ownedCopies(id)).toBe(again.ownedCopies(id));
      expect(first.ownedCopies(id)).toBeGreaterThanOrEqual(0);
      expect(first.ownedCopies(id)).toBeLessThanOrEqual(DEV_MAX_COPIES);
    }
    const counts = MOD_IDS.map((id) => first.ownedCopies(id));
    expect(counts.some((count) => count === 0)).toBe(true);
    expect(counts.some((count) => count >= 6)).toBe(true);
    expect(MOD_IDS.map((id) => seededCollection(7).ownedCopies(id))).not.toEqual(counts);
  });
});
