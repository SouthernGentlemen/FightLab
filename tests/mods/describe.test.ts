import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { effectLines } from "../../src/mods/describe.ts";
import type { Amount, Condition, ModEffect, Payoff, Per, Status } from "../../src/mods/effects.ts";
import { DEFINITIONS } from "../../src/mods/registry.ts";
import type { ModDefinition } from "../../src/mods/registry.ts";
import { STARS } from "../../src/mods/stars.ts";
import type { ModType } from "../../src/mods/types.ts";

function amount(value: number, per: Per = "flat"): Amount {
  return { value: [value, value + 1, value + 2], per };
}

function payoff(kind: "damage" | "heal" | "status", value: number, per: Per = "flat"): Payoff {
  return { kind, amount: amount(value, per) };
}

function exchange(payoffs: readonly Payoff[], when?: Condition): ModEffect {
  return when ? { kind: "exchange", payoffs, when } : { kind: "exchange", payoffs };
}

let fixtureId = 0;
function fixture(type: ModType, affinity: ActionType | null, effect: ModEffect): ModDefinition {
  fixtureId++;
  return {
    id: `fixture-${fixtureId}`,
    name: `Fixture ${fixtureId}`,
    rarity: "common",
    type,
    affinity,
    shape: "single",
    effect,
  };
}

const PER_FIXTURES: readonly ModDefinition[] = [
  fixture("solar", "strike", exchange([payoff("damage", 1, "flat")])),
  fixture("solar", "strike", exchange([payoff("damage", 1, "cell")])),
  fixture("solar", null, exchange([payoff("damage", 1, "adjacent")])),
  fixture("solar", null, exchange([payoff("damage", 1, "adjacent-same")])),
  fixture("solar", null, exchange([payoff("damage", 1, "adjacent-other")])),
  fixture("solar", null, exchange([payoff("damage", 1, "burn")])),
  fixture("arc", null, exchange([payoff("damage", 1, "shock")])),
  fixture("void", null, exchange([payoff("damage", 1, "poison")])),
];

const CONDITION_FIXTURES: readonly ModDefinition[] = [
  fixture("solar", "strike", exchange(
    [payoff("status", 2)],
    { kind: "adjacent-to", type: "solar" },
  )),
  fixture("arc", "tech", exchange(
    [payoff("damage", 2)],
    { kind: "opponent-has", status: "shock" },
  )),
];

const BOOST_FIXTURES: readonly ModDefinition[] = [
  fixture("neutral", null, { kind: "boost", amount: [1, 2, 3], to: "adjacent" }),
  fixture("solar", "tech", { kind: "boost", amount: [1, 2, 3], to: "adjacent-same" }),
];

const STATUS_FIXTURES: readonly ModDefinition[] = [
  fixture("solar", "strike", exchange([payoff("status", 2)])),
  fixture("arc", "tech", exchange([payoff("status", 2)])),
  fixture("void", "block", exchange([payoff("status", 2)])),
  fixture("neutral", null, exchange([payoff("status", 2)])),
];

const LANDING_FIXTURES: readonly ModDefinition[] = [
  fixture("solar", "strike", exchange([payoff("status", 1)])),
  fixture("solar", "tech", exchange([payoff("status", 1)])),
  fixture("solar", "block", exchange([payoff("status", 1)])),
  fixture("solar", null, exchange([payoff("status", 1)])),
];

const PAYOFF_FIXTURE = fixture("solar", "block", exchange([
  payoff("damage", 1, "cell"),
  payoff("heal", 1),
  { kind: "cleanse", status: "burn", amount: amount(1) },
]));

const PERK_FIXTURES: readonly ModDefinition[] = [
  fixture("neutral", null, { kind: "perk", perk: "income", amount: [2, 3, 4] }),
  fixture("neutral", null, { kind: "perk", perk: "free-reroll", amount: [1, 2, 3] }),
  fixture("neutral", null, { kind: "perk", perk: "style", amount: [1, 2, 3] }),
];

const VOCABULARY_FIXTURES = [
  ...PER_FIXTURES,
  ...CONDITION_FIXTURES,
  ...BOOST_FIXTURES,
  ...STATUS_FIXTURES,
  ...LANDING_FIXTURES,
  PAYOFF_FIXTURE,
  ...PERK_FIXTURES,
] as const;

describe("rules text", () => {
  it("folds scale, landing and conditions into payoff text", () => {
    expect(effectLines(PER_FIXTURES[1], 1)).toEqual(["+1 damage per cell on Strike"]);
    expect(effectLines(CONDITION_FIXTURES[0], 1)).toEqual(["Burn 2 on a hit if next to Solar"]);
    expect(effectLines(fixture(
      "solar",
      "strike",
      exchange([payoff("status", 1, "adjacent-same")]),
    ), 1)).toEqual(["Burn 1 per adjacent Solar mod on a hit"]);
  });

  it("writes compact boost and perk rules", () => {
    expect(effectLines(BOOST_FIXTURES[0], 1)).toEqual(["Adjacent mods +1"]);
    expect(effectLines(BOOST_FIXTURES[1], 2)).toEqual(["Adjacent Solar mods +2 on Tech"]);
    expect(effectLines(PERK_FIXTURES[0], 1)).toEqual(["+$2 every payday"]);
    expect(effectLines(PERK_FIXTURES[1], 2)).toEqual(["+2 free rerolls every day"]);
  });

  it("names the status from the mod type and describes every landing mode", () => {
    expect(effectLines(STATUS_FIXTURES[0], 1)).toEqual(["Burn 2 on a hit"]);
    expect(effectLines(STATUS_FIXTURES[1], 1)).toEqual(["Shock 2 on a hit"]);
    expect(effectLines(STATUS_FIXTURES[2], 1)).toEqual(["Poison 2 if guard holds"]);
    expect(effectLines(STATUS_FIXTURES[3], 1)).toEqual(["No status each exchange"]);
    expect(LANDING_FIXTURES.map((definition) => effectLines(definition, 1)[0])).toEqual([
      "Burn 1 on a hit",
      "Burn 1 on a hit",
      "Burn 1 if guard holds",
      "Burn 1 each exchange",
    ]);
  });

  it("fits every registry mod and vocabulary fixture in three 60-character lines at every star", () => {
    for (const definition of [...DEFINITIONS, ...VOCABULARY_FIXTURES]) {
      for (const stars of STARS) {
        const lines = effectLines(definition, stars);
        expect(lines.length, `${definition.id} ★${stars}: ${lines.join(" | ")}`).toBeLessThanOrEqual(3);
        for (const line of lines) {
          expect(line.length, `${definition.id} ★${stars}: ${line}`).toBeLessThanOrEqual(60);
        }
      }
    }
  });

  it("changes star-scaled rules at each level", () => {
    const definitions = [...PER_FIXTURES, ...BOOST_FIXTURES, ...PERK_FIXTURES, PAYOFF_FIXTURE];
    for (const definition of definitions) {
      const texts = STARS.map((stars) => effectLines(definition, stars).join(" "));
      expect(new Set(texts).size, definition.id).toBe(3);
    }
  });
});
