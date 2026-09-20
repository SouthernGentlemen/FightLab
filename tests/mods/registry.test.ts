import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { generate } from "../../src/mods/effects.ts";
import { RARITIES, RARITY } from "../../src/mods/rarity.ts";
import { DEFINITIONS, MOD_IDS, REGISTRY, catalogueProblems, definitionProblems, isModId, priceOf, registryProblems } from "../../src/mods/registry.ts";
import type { ModDefinition } from "../../src/mods/registry.ts";
import { MOD_TYPES } from "../../src/mods/tags.ts";
import { pick } from "./fixtures.ts";

describe("the mod registry", () => {
  it("exposes one ordered definition for every registered id", () => {
    expect(DEFINITIONS.map(({ id }) => id)).toEqual(MOD_IDS);
    for (const id of MOD_IDS) expect(REGISTRY[id]).toBe(DEFINITIONS.find((definition) => definition.id === id));
  });

  it("is the sound, balanced 64-mod catalogue", () => {
    expect(DEFINITIONS).toHaveLength(64);
    expect(MOD_IDS).toHaveLength(64);
    expect(catalogueProblems(DEFINITIONS)).toEqual([]);
    expect(registryProblems(DEFINITIONS)).toEqual([]);
    expect(new Set(MOD_IDS).size).toBe(MOD_IDS.length);
    for (const id of MOD_IDS) expect(REGISTRY[id].id).toBe(id);
    expect(isModId(pick().id)).toBe(true);
    expect(isModId("not-a-real-mod")).toBe(false);
  });

  it("catches a broken definition", () => {
    const base = pick();
    const legacy = { ...base, effect: undefined };
    const broken = (patch: Partial<ModDefinition>) => definitionProblems({ ...legacy, ...patch });
    expect(broken({ type: "fire" as ModDefinition["type"] })).toEqual([expect.stringMatching(/unknown type/)]);
    expect(broken({ affinity: "guard" as ModDefinition["affinity"] })).toEqual([expect.stringMatching(/unknown affinity/)]);
    expect(broken({ effects: [generate("heat", [2, 2, 2])] })).toEqual([expect.stringMatching(/nothing grows/)]);
    expect(broken({ effects: [generate("heat", [1, 2, 3.5])] })).toContainEqual(expect.stringMatching(/three whole amounts/));
    expect(registryProblems([base, base])).toEqual([
      `id '${base.id}' is used twice`,
      `name '${base.name}' is used twice`,
    ]);
  });

  it("covers every type, affinity and rarity", () => {
    for (const type of MOD_TYPES) expect(DEFINITIONS.some((definition) => definition.type === type), type).toBe(true);
    for (const affinity of ACTION_TYPES) expect(DEFINITIONS.some((definition) => definition.affinity === affinity), affinity).toBe(true);
    for (const rarity of RARITIES) expect(DEFINITIONS.some((definition) => definition.rarity === rarity), rarity).toBe(true);
  });

  it("prices a mod by its rarity alone, and keeps rarity out of the star numbers", () => {
    for (const id of MOD_IDS) expect(priceOf(id)).toBe(RARITY[REGISTRY[id].rarity].price);
    expect(Object.keys(pick()).sort()).toEqual(["affinity", "description", "effect", "effects", "id", "name", "rarity", "shape", "type", "visual"]);
  });

  it("is frozen all the way down", () => {
    for (const definition of DEFINITIONS) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.effects)).toBe(true);
      expect(definition.effects.every(Object.isFrozen)).toBe(true);
      expect(Object.isFrozen(definition.effect)).toBe(true);
    }
  });
});
