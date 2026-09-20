import { describe, expect, it } from "vitest";

import { compileBuild } from "../../src/mods/compile.ts";
import {
  NO_FILTER,
  armoryList,
  collected,
  filterSummary,
  toggle,
} from "../../src/mods/armory.ts";
import type { CatalogAffinity, CatalogFilter, Owned, SizeClass } from "../../src/mods/armory.ts";
import { place } from "../../src/mods/grid.ts";
import { RARITIES } from "../../src/mods/rarity.ts";
import { DEFINITIONS, MOD_IDS, REGISTRY } from "../../src/mods/registry.ts";
import { SHAPES } from "../../src/mods/shapes.ts";
import { MOD_TYPES } from "../../src/mods/tags.ts";
import { DEV_MAX_COPIES, seededCollection } from "../../src/run/collection.ts";
import { pick, placement } from "./fixtures.ts";

const NONE: Owned = () => 0;
const ids = (filter: CatalogFilter) => armoryList(filter).map((definition) => definition.id);

describe("the Armory's catalogue", () => {
  it("lists every registered mod, in registry order, as the very records combat runs on", () => {
    const listed = armoryList(NO_FILTER);
    expect(listed.map((definition) => definition.id)).toEqual([...MOD_IDS]);
    listed.forEach((definition, index) => expect(definition).toBe(REGISTRY[MOD_IDS[index]]));

    const chosen = pick({ type: "solar", affinity: "strike", size: 2 });
    const build = compileBuild(place([], { uid: 1, stars: 2, ...placement([chosen, 0, 0]) })!);
    expect(build.program.mods[0].definition).toBe(listed.find((definition) => definition.id === chosen.id));
  });

  it("filters each group alone, with OR inside the group", () => {
    for (const type of MOD_TYPES) {
      const filter = toggle(NO_FILTER, "types", type);
      const listed = armoryList(filter);
      expect(listed.length, type).toBeGreaterThan(0);
      expect(listed.every((definition) => definition.type === type), type).toBe(true);
    }

    for (const affinity of ["none", "strike", "tech", "block"] as const satisfies readonly CatalogAffinity[]) {
      const filter = toggle(NO_FILTER, "affinities", affinity);
      const listed = armoryList(filter);
      expect(listed.length, affinity).toBeGreaterThan(0);
      expect(listed.every((definition) => (definition.affinity ?? "none") === affinity), affinity).toBe(true);
    }

    for (const size of [1, 2, 3, 4] as const satisfies readonly SizeClass[]) {
      const filter = toggle(NO_FILTER, "sizes", size);
      const listed = armoryList(filter);
      expect(listed.length, String(size)).toBeGreaterThan(0);
      expect(listed.every((definition) => SHAPES[definition.shape].cells.length === size), String(size)).toBe(true);
    }

    for (const rarity of RARITIES) {
      const filter = toggle(NO_FILTER, "rarities", rarity);
      const listed = armoryList(filter);
      expect(listed.length, rarity).toBeGreaterThan(0);
      expect(listed.every((definition) => definition.rarity === rarity), rarity).toBe(true);
    }

    let filter = toggle(NO_FILTER, "types", "solar");
    filter = toggle(filter, "types", "arc");
    expect(armoryList(filter).every((definition) =>
      definition.type === "solar" || definition.type === "arc")).toBe(true);
  });

  it("ANDs two and three groups together", () => {
    let two = toggle(NO_FILTER, "types", "solar");
    two = toggle(two, "affinities", "strike");
    expect(ids(two)).toEqual(DEFINITIONS.filter((definition) =>
      definition.type === "solar" && definition.affinity === "strike").map(({ id }) => id));

    let three = toggle(two, "sizes", 3);
    expect(ids(three)).toEqual(DEFINITIONS.filter((definition) =>
      definition.type === "solar" && definition.affinity === "strike" && SHAPES[definition.shape].cells.length === 3)
      .map(({ id }) => id));

    three = toggle(three, "rarities", "super-rare");
    expect(ids(three)).toEqual(DEFINITIONS.filter((definition) =>
      definition.type === "solar" && definition.affinity === "strike"
      && SHAPES[definition.shape].cells.length === 3 && definition.rarity === "super-rare").map(({ id }) => id));
  });

  it("can produce an empty result", () => {
    let filter = toggle(NO_FILTER, "types", "neutral");
    filter = toggle(filter, "affinities", "block");
    expect(armoryList(filter)).toEqual([]);
  });

  it("toggles choices off again, and clearing brings back every mod", () => {
    let filter = toggle(NO_FILTER, "types", "void");
    filter = toggle(filter, "sizes", 4);
    filter = toggle(filter, "rarities", "legendary");
    expect(filterSummary(filter)).toBe("3");
    expect(armoryList(filter).length).toBeLessThan(DEFINITIONS.length);

    filter = toggle(filter, "types", "void");
    expect(filter.types.size).toBe(0);
    expect(filterSummary(filter)).toBe("2");

    expect(filterSummary(NO_FILTER)).toBe("NONE");
    expect(armoryList(NO_FILTER)).toEqual(DEFINITIONS);
  });

  it("counts how much of the catalogue is collected", () => {
    expect(collected(NONE)).toEqual({ owned: 0, total: DEFINITIONS.length });
    const owned = pick();
    expect(collected((mod) => (mod === owned.id ? 6 : 0)))
      .toEqual({ owned: 1, total: DEFINITIONS.length });
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
