import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { generate } from "../../src/mods/effects.ts";
import { RARITIES, RARITY } from "../../src/mods/rarity.ts";
import { DEFINITIONS, MOD_IDS, REGISTRY, definitionProblems, isModId, priceOf, registryProblems } from "../../src/mods/registry.ts";
import type { ModDefinition } from "../../src/mods/registry.ts";
import { MOD_TYPES } from "../../src/mods/tags.ts";

/** The seed catalogue: name, type, affinity and rarity for each of the twenty-five. */
const SEED: ReadonlyArray<readonly [string, string, string | null, string]> = [
  ["Heat Coil", "solar", null, "common"], ["Basic Sink", "solar", "block", "common"], ["Arc Dynamo", "arc", null, "common"],
  ["Battery Cell", "arc", null, "common"], ["Void Tap", "void", null, "common"],
  ["Cinder Edge", "solar", "strike", "uncommon"], ["Thermal Relay", "solar", "tech", "uncommon"], ["Live Wire", "arc", "strike", "uncommon"],
  ["Capacitor Guard", "arc", "block", "uncommon"], ["Venom Tap", "void", "strike", "uncommon"],
  ["Furnace", "solar", null, "rare"], ["Cooling Array", "solar", "block", "rare"], ["Chain Circuit", "arc", "tech", "rare"],
  ["Storm Cell", "arc", "strike", "rare"], ["Null Reservoir", "void", null, "rare"],
  ["Afterburner", "solar", "strike", "super-rare"], ["Phoenix Sink", "solar", "block", "super-rare"], ["Overclock", "arc", "tech", "super-rare"],
  ["Feedback Loop", "arc", null, "super-rare"], ["Event Horizon", "void", "tech", "super-rare"],
  ["Solar Flare", "solar", "strike", "legendary"], ["Thunderhead", "arc", "strike", "legendary"], ["Singularity", "void", "tech", "legendary"],
  ["Black Battery", "void", null, "legendary"], ["Heat Death", "void", null, "legendary"],
];

describe("the mod registry", () => {
  it("holds the twenty-five seed mods with one type, optional affinity and rarity, plus four Neutral utility mods", () => {
    expect(MOD_IDS).toHaveLength(29);
    for (const [name, type, affinity, rarity] of SEED) {
      const found = DEFINITIONS.find((definition) => definition.name === name);
      expect(found, name).toBeDefined();
      expect(found!.type, name).toBe(type);
      expect(found!.affinity, name).toBe(affinity);
      expect(found!.rarity, name).toBe(rarity);
    }
    expect(DEFINITIONS.filter((definition) => definition.type === "neutral").map((definition) => definition.name))
      .toEqual(["Piggy Bank", "Coupon", "Crowd Pleaser", "Amplifier"]);
  });

  it("is sound: every definition validates and no id or name is used twice", () => {
    expect(registryProblems(DEFINITIONS)).toEqual([]);
    expect(new Set(MOD_IDS).size).toBe(MOD_IDS.length);
    for (const id of MOD_IDS) expect(REGISTRY[id].id).toBe(id);
    expect(isModId("heat-coil")).toBe(true);
    expect(isModId("ember")).toBe(false);
  });

  it("catches a broken definition", () => {
    const coil = REGISTRY["heat-coil"];
    const broken = (patch: Partial<ModDefinition>) => definitionProblems({ ...coil, ...patch });
    expect(broken({ type: "fire" as ModDefinition["type"] })).toEqual([expect.stringMatching(/unknown type/)]);
    expect(broken({ affinity: "guard" as ModDefinition["affinity"] })).toEqual([expect.stringMatching(/unknown affinity/)]);
    expect(broken({ effects: [generate("heat", [2, 2, 2])] })).toEqual([expect.stringMatching(/nothing grows/)]);
    expect(broken({ effects: [generate("heat", [1, 2, 3.5])] })).toContainEqual(expect.stringMatching(/three whole amounts/));
    expect(broken({ ports: [{ cell: 1, side: "e", flow: "out", resource: "heat" }] })).toEqual([expect.stringMatching(/cell 1/)]);
    expect(registryProblems([coil, coil])).toEqual(["id 'heat-coil' is used twice", "name 'Heat Coil' is used twice"]);
  });

  it("covers every type, affinity and rarity", () => {
    for (const type of MOD_TYPES) expect(DEFINITIONS.some((definition) => definition.type === type), type).toBe(true);
    for (const affinity of ACTION_TYPES) expect(DEFINITIONS.some((definition) => definition.affinity === affinity), affinity).toBe(true);
    for (const rarity of RARITIES) expect(DEFINITIONS.filter((definition) => definition.rarity === rarity).length, rarity).toBeGreaterThanOrEqual(5);
  });

  it("prices a mod by its rarity alone, and keeps rarity out of the star numbers", () => {
    for (const id of MOD_IDS) expect(priceOf(id)).toBe(RARITY[REGISTRY[id].rarity].price);
    // One record per mod, whatever its stars: rarity is a field of the record, stars a column of its numbers.
    expect(Object.keys(REGISTRY["cinder-edge"]).sort()).toEqual(["affinity", "description", "effects", "id", "name", "ports", "rarity", "shape", "type", "visual"]);
  });

  it("is frozen all the way down", () => {
    for (const definition of DEFINITIONS) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.effects)).toBe(true);
      expect(definition.effects.every(Object.isFrozen)).toBe(true);
    }
  });
});
