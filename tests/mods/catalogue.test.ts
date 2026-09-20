import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import type { ActionType } from "../../src/battle/actions.ts";
import type { ModEffect, Payoff } from "../../src/mods/effects.ts";
import { RARITIES } from "../../src/mods/rarity.ts";
import { catalogueProblems } from "../../src/mods/registry.ts";
import type { ModDefinition } from "../../src/mods/registry.ts";
import type { ShapeId } from "../../src/mods/shapes.ts";
import { MOD_TYPES } from "../../src/mods/tags.ts";
import type { ModType } from "../../src/mods/tags.ts";

const AFFINITIES = [null, ...ACTION_TYPES] as const;
const RARITY_BY_SLOT = [...RARITIES.slice(0, 3).flatMap((rarity) => Array(4).fill(rarity)), "super-rare", "super-rare", "legendary", "legendary"] as const;
const TETROMINOES: readonly ShapeId[] = [
  "tetromino-i", "tetromino-o", "tetromino-t", "tetromino-s", "tetromino-z", "tetromino-j", "tetromino-l",
];
const SHAPES_A: readonly ShapeId[] = [...TETROMINOES, "triomino-i", "triomino-i", "triomino-l", "domino", "domino", "domino", "domino", "single", "single"];
const SHAPES_B: readonly ShapeId[] = [...TETROMINOES, "triomino-i", "triomino-l", "triomino-l", "domino", "domino", "domino", "domino", "single", "single"];

const amount = (per: "flat" | "cell" | "adjacent" | "adjacent-same" | "adjacent-other" | "burn" | "shock" | "poison" = "flat") =>
  ({ value: [1, 2, 3] as const, per });

const exchange = (payoffs: readonly Payoff[] = [{ kind: "damage", amount: amount() }], when?: ModEffect & never): ModEffect =>
  ({ kind: "exchange", payoffs, ...(when === undefined ? {} : { when }) } as ModEffect);

function definition(type: ModType, index: number, shape: ShapeId): ModDefinition {
  const affinity = AFFINITIES[index % AFFINITIES.length];
  const prefix = type === "solar" ? "S" : type === "arc" ? "A" : type === "void" ? "V" : "N";
  return {
    id: `${type}-${index}`,
    name: `${prefix}${index}`,
    description: "synthetic target",
    rarity: RARITY_BY_SLOT[index],
    type,
    affinity,
    shape,
    effects: [],
    effect: exchange(),
    visual: { glyph: type === "neutral" ? "chip" : type },
  };
}

function goodCatalogue(): ModDefinition[] {
  return MOD_TYPES.flatMap((type, typeIndex) => {
    const shapes = typeIndex % 2 === 0 ? SHAPES_A : SHAPES_B;
    return shapes.map((shape, index) => definition(type, index, shape));
  });
}

function changed(index: number, patch: Partial<ModDefinition>): ModDefinition[] {
  return goodCatalogue().map((definition, at) => at === index ? { ...definition, ...patch } : definition);
}

function indexOf(predicate: (definition: ModDefinition) => boolean): number {
  const index = goodCatalogue().findIndex(predicate);
  if (index < 0) throw new Error("synthetic catalogue fixture did not contain requested slot");
  return index;
}

function messages(definitions: readonly ModDefinition[]): string {
  return catalogueProblems(definitions).join("\n");
}

describe("catalogueProblems", () => {
  it("accepts a balanced 64-mod catalogue and each 16-mod authoring slice", () => {
    const definitions = goodCatalogue();
    expect(catalogueProblems(definitions)).toEqual([]);
    for (const type of MOD_TYPES) expect(catalogueProblems(definitions, { type }), type).toEqual([]);
  });

  it("reports count errors with the expected count, actual count and distance", () => {
    const short = goodCatalogue().slice(0, -1);
    expect(catalogueProblems(short)).toContain("catalogue count: expected 64, got 63 (off by 1 low)");

    const solarShort = goodCatalogue().filter((definition) => definition.id !== "solar-0");
    expect(catalogueProblems(solarShort, { type: "solar" }))
      .toContain("type solar count: expected 16, got 15 (off by 1 low)");
  });

  it("checks type, affinity, pair, size, shape and rarity balance", () => {
    expect(messages(changed(0, { type: "arc" }))).toContain("type solar count: expected 16, got 15 (off by 1 low)");

    expect(messages(changed(0, { affinity: "strike" }))).toContain("affinity none count: expected 16, got 15 (off by 1 low)");

    expect(messages(changed(0, { shape: "domino" })))
      .toContain("shape tetromino-i count: expected 4, got 3 (off by 1 low)");
    expect(messages(changed(0, { shape: "domino" })))
      .toContain("size 4 count: expected 28, got 27 (off by 1 low)");

    expect(messages(changed(0, { rarity: "legendary" })))
      .toContain("rarity common count: expected 16, got 15 (off by 1 low)");
  });

  it("requires unique ids and names, and caps names at sixteen characters", () => {
    const duplicate = changed(1, { id: "solar-0", name: "S0" });
    expect(catalogueProblems(duplicate)).toContain("id 'solar-0' is used twice");
    expect(catalogueProblems(duplicate)).toContain("name 'S0' is used twice");

    const long = changed(0, { name: "SeventeenLetters!!" });
    expect(messages(long)).toContain("name is 17 characters; maximum is 16");
  });

  it("rejects vocabulary outside §5 and status payoffs on Neutral", () => {
    const badEffect = changed(0, { effect: { kind: "legacy" } as unknown as ModEffect });
    expect(messages(badEffect)).toContain("unknown effect kind 'legacy'");

    const badPer = changed(0, {
      effect: exchange([{ kind: "damage", amount: { value: [1, 2, 3], per: "links" as "flat" } }]),
    });
    expect(messages(badPer)).toContain("scale 'links' is not allowed at this rarity");

    const neutral = indexOf((definition) => definition.type === "neutral" && definition.rarity === "common");
    const neutralStatus = changed(neutral, { effect: exchange([{ kind: "status", amount: amount() }]) });
    expect(messages(neutralStatus)).toContain("status payoff is not allowed on Neutral");
  });

  it("enforces the cumulative rarity ladder", () => {
    const common = indexOf((definition) => definition.rarity === "common" && definition.type === "solar");
    expect(messages(changed(common, { effect: exchange([{ kind: "damage", amount: amount("adjacent") }]) })))
      .toContain("scale 'adjacent' is not allowed at this rarity");

    const commonTwo = exchange([{ kind: "damage", amount: amount() }, { kind: "heal", amount: amount() }]);
    expect(messages(changed(common, { effect: commonTwo }))).toContain("has 2 payoffs; this rarity allows 1");

    const uncommon = indexOf((definition) => definition.rarity === "uncommon" && definition.type === "solar");
    const uncommonThree = exchange([
      { kind: "damage", amount: amount() }, { kind: "heal", amount: amount() }, { kind: "cleanse", status: "burn", amount: amount() },
    ]);
    expect(messages(changed(uncommon, { effect: uncommonThree }))).toContain("has 3 payoffs; this rarity allows 2");

    const rare = indexOf((definition) => definition.rarity === "rare" && definition.type === "solar");
    expect(messages(changed(rare, { effect: exchange([{ kind: "damage", amount: amount("burn") }]) })))
      .toContain("scale 'burn' is not allowed at this rarity");

    const superRare = indexOf((definition) => definition.rarity === "super-rare");
    expect(messages(changed(superRare, { effect: { kind: "boost", amount: [1, 2, 3], to: "adjacent" } })))
      .toContain("boost is Legendary-only");

    const legendary = indexOf((definition) => definition.rarity === "legendary");
    expect(catalogueProblems(changed(legendary, { effect: { kind: "boost", amount: [1, 2, 3], to: "adjacent-same" } }))).toEqual([]);
  });

  it("allows cleanse from Uncommon, per-status and opponent-has from Super Rare, and perks at any rarity", () => {
    const uncommon = indexOf((definition) => definition.rarity === "uncommon" && definition.type === "solar");
    expect(catalogueProblems(changed(uncommon, {
      effect: exchange([{ kind: "cleanse", status: "burn", amount: amount("adjacent") }]),
    }))).toEqual([]);

    const superRare = indexOf((definition) => definition.rarity === "super-rare" && definition.type === "solar");
    expect(catalogueProblems(changed(superRare, {
      effect: { kind: "exchange", payoffs: [{ kind: "damage", amount: amount("burn") }], when: { kind: "opponent-has", status: "burn" } },
    }))).toEqual([]);

    const perk = indexOf((definition) => definition.type === "neutral" && definition.affinity === null && definition.rarity === "common");
    expect(catalogueProblems(changed(perk, { effect: { kind: "perk", perk: "income", amount: [1, 2, 3] } }))).toEqual([]);
  });

  it("requires at least one value to increase at both star steps", () => {
    const stalled = changed(0, {
      effect: { kind: "exchange", payoffs: [{ kind: "damage", amount: { value: [1, 1, 1], per: "flat" } }] },
    });
    expect(messages(stalled)).toContain("nothing grows at every ★");
  });
});
