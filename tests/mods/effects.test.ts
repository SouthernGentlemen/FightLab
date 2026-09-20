import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import type { Amount, Condition, ModEffect, Payoff, Per, Status } from "../../src/mods/effects.ts";
import { EMPTY_PROGRAM, programOf } from "../../src/mods/program.ts";
import type { ModProgram } from "../../src/mods/program.ts";
import type { ModDefinition, ModId } from "../../src/mods/registry.ts";
import { freshState, prepareExchange, settleExchange, staticTotal } from "../../src/mods/resolve.ts";
import type { ModState, Outcome } from "../../src/mods/resolve.ts";
import type { ShapeId } from "../../src/mods/shapes.ts";
import type { Stars } from "../../src/mods/stars.ts";
import type { ModType } from "../../src/mods/tags.ts";

const IDS = {
  a: "heat-coil",
  b: "basic-sink",
  c: "arc-dynamo",
  d: "battery-cell",
  domino: "cinder-edge",
} as const satisfies Record<string, ModId>;

const SHAPE: Readonly<Record<ModId, ShapeId | undefined>> = {
  "heat-coil": "single",
  "basic-sink": "single",
  "arc-dynamo": "single",
  "battery-cell": "single",
  "cinder-edge": "domino",
} as Partial<Record<ModId, ShapeId>> as Record<ModId, ShapeId | undefined>;

function amount(value: number, per: Per = "flat"): Amount {
  return { value: [value, value, value], per };
}

function payoff(kind: "damage" | "heal" | "status", value: number, per: Per = "flat"): Payoff {
  return { kind, amount: amount(value, per) };
}

function exchange(payoffs: readonly Payoff[], when?: Condition): ModEffect {
  return when ? { kind: "exchange", payoffs, when } : { kind: "exchange", payoffs };
}

function definition(
  id: ModId,
  type: ModType,
  affinity: ActionType | null,
  effect: ModEffect,
  shape: ShapeId = SHAPE[id] ?? "single",
): ModDefinition {
  return {
    id,
    name: `Fixture ${id}`,
    description: "Fixture only.",
    rarity: "common",
    type,
    affinity,
    shape,
    effects: [],
    effect,
    visual: { glyph: "chip" },
  };
}

interface Piece {
  readonly definition: ModDefinition;
  readonly x: number;
  readonly y: number;
  readonly stars?: Stars;
}

function fixtureProgram(...pieces: readonly Piece[]): ModProgram {
  const definitions: Partial<Record<ModId, ModDefinition>> = {};
  const placed = pieces.map(({ definition: entry, x, y, stars = 1 }, index) => {
    definitions[entry.id as ModId] = entry;
    return { uid: index + 1, mod: entry.id as ModId, stars, rotation: 0 as const, x, y };
  });
  return programOf(placed, definitions);
}

function state(patch: Partial<ModState> = {}): ModState {
  return { ...freshState(EMPTY_PROGRAM), ...patch };
}

function prepared(program: ModProgram, action: ActionType = "strike", opponent = state()) {
  return prepareExchange([state(), opponent], [program, EMPTY_PROGRAM], [action, "strike"]);
}

const QUIET: Outcome = { landed: [false, false], hurt: [false, false], exposed: [0, 0] };
const PLAYER_LANDS: Outcome = { landed: [true, false], hurt: [false, true], exposed: [0, 0] };
const OPPONENT_LANDS: Outcome = { landed: [false, true], hurt: [true, false], exposed: [0, 0] };

describe("new effect vocabulary", () => {
  it("multiplies amounts by every Per scale", () => {
    const simple: ReadonlyArray<readonly [Per, number, ModDefinition, ModState?]> = [
      ["flat", 2, definition(IDS.a, "solar", null, exchange([payoff("damage", 2)]))],
      ["cell", 4, definition(IDS.domino, "solar", null, exchange([payoff("damage", 2, "cell")]), "domino")],
      ["burn", 4, definition(IDS.a, "solar", null, exchange([payoff("damage", 2, "burn")])), state({ burn: 2 })],
      ["shock", 6, definition(IDS.a, "solar", null, exchange([payoff("damage", 2, "shock")])), state({ shock: 3 })],
      ["poison", 8, definition(IDS.a, "solar", null, exchange([payoff("damage", 2, "poison")])), state({ poison: 4 })],
    ];
    for (const [per, expected, mod, opponent] of simple) {
      expect(prepared(fixtureProgram({ definition: mod, x: 0, y: 0 }), "strike", opponent).bonus[0], per).toBe(expected);
    }

    for (const [per, expected] of [["adjacent", 2], ["adjacent-same", 1], ["adjacent-other", 1]] as const) {
      const target = definition(IDS.a, "solar", null, exchange([payoff("damage", 1, per)]));
      const same = definition(IDS.b, "solar", null, exchange([]));
      const other = definition(IDS.c, "arc", null, exchange([]));
      const program = fixtureProgram(
        { definition: target, x: 1, y: 1 },
        { definition: same, x: 0, y: 1 },
        { definition: other, x: 2, y: 1 },
      );
      const active = program.mods[1];
      expect(program.mods.find((mod) => mod.definition.id === IDS.a)).toMatchObject({
        cells: 1, adjacentSame: 1, adjacentOther: 1,
      });
      expect(active).toBeDefined();
      expect(prepared(program).bonus[0], per).toBe(expected);
    }
  });

  it("applies both Condition kinds", () => {
    const neighbour = definition(IDS.b, "arc", null, exchange([]));
    const adjacent = (type: ModType) => definition(
      IDS.a, "solar", null, exchange([payoff("damage", 3)], { kind: "adjacent-to", type }),
    );
    expect(prepared(fixtureProgram(
      { definition: adjacent("arc"), x: 1, y: 1 },
      { definition: neighbour, x: 0, y: 1 },
    )).bonus[0]).toBe(3);
    expect(prepared(fixtureProgram(
      { definition: adjacent("void"), x: 1, y: 1 },
      { definition: neighbour, x: 0, y: 1 },
    )).bonus[0]).toBe(0);

    const hasBurn = definition(
      IDS.a, "solar", null, exchange([payoff("damage", 4)], { kind: "opponent-has", status: "burn" }),
    );
    expect(prepared(fixtureProgram({ definition: hasBurn, x: 0, y: 0 }), "strike", state({ burn: 1 })).bonus[0]).toBe(4);
    expect(prepared(fixtureProgram({ definition: hasBurn, x: 0, y: 0 }), "strike", state()).bonus[0]).toBe(0);
  });

  it("precomputes and applies adjacent boosts only when the booster fires", () => {
    const target = definition(IDS.a, "solar", null, exchange([payoff("damage", 1)]));
    const booster = definition(IDS.b, "solar", "tech", { kind: "boost", amount: [2, 2, 2], to: "adjacent-same" });
    const program = fixtureProgram(
      { definition: target, x: 1, y: 1 },
      { definition: booster, x: 0, y: 1 },
    );
    const active = program.mods.find((mod) => mod.definition.id === IDS.a)!;
    expect(active.boost).toEqual({ strike: 0, tech: 2, block: 0 });
    expect(prepared(program, "strike").bonus[0]).toBe(1);
    expect(prepared(program, "tech").bonus[0]).toBe(3);

    const other = definition(IDS.c, "arc", null, exchange([payoff("damage", 1)]));
    const sameOnly = fixtureProgram(
      { definition: other, x: 1, y: 1 },
      { definition: booster, x: 0, y: 1 },
    );
    expect(sameOnly.mods.find((mod) => mod.definition.id === IDS.c)!.boost.tech).toBe(0);

    const any = definition(IDS.b, "solar", null, { kind: "boost", amount: [2, 2, 2], to: "adjacent" });
    const anyProgram = fixtureProgram(
      { definition: other, x: 1, y: 1 },
      { definition: any, x: 0, y: 1 },
    );
    expect(anyProgram.mods.find((mod) => mod.definition.id === IDS.c)!.boost).toEqual({ strike: 2, tech: 2, block: 2 });
  });

  it("maps status payoff through the mod type", () => {
    const cases: ReadonlyArray<readonly [ModType, Status | null, ModId]> = [
      ["solar", "burn", IDS.a], ["arc", "shock", IDS.b], ["void", "poison", IDS.c], ["neutral", null, IDS.d],
    ];
    for (const [type, status, id] of cases) {
      const mod = definition(id, type, null, exchange([payoff("status", 2)]));
      const settled = settleExchange(prepared(fixtureProgram({ definition: mod, x: 0, y: 0 })), QUIET);
      expect(settled[1].burn + settled[1].shock + settled[1].poison, type).toBe(status === null ? 0 : 2);
      if (status !== null) expect(settled[1][status], type).toBe(2);
    }
  });

  it("keeps Strike, Tech, Block and no-affinity landing rules", () => {
    const lands = (affinity: ActionType | null, outcome: Outcome) => {
      const mod = definition(IDS.a, "solar", affinity, exchange([payoff("status", 2)]));
      const action = affinity ?? "strike";
      return settleExchange(prepared(fixtureProgram({ definition: mod, x: 0, y: 0 }), action), outcome)[1].burn;
    };
    expect(lands("strike", QUIET)).toBe(0);
    expect(lands("strike", PLAYER_LANDS)).toBe(2);
    expect(lands("tech", QUIET)).toBe(0);
    expect(lands("tech", PLAYER_LANDS)).toBe(2);
    expect(lands("block", QUIET)).toBe(2);
    expect(lands("block", OPPONENT_LANDS)).toBe(0);
    expect(lands(null, OPPONENT_LANDS)).toBe(2);
  });

  it("resolves damage, heal and cleanse together", () => {
    const effect = exchange([
      payoff("damage", 2),
      payoff("heal", 3),
      { kind: "cleanse", status: "burn", amount: amount(1) },
    ]);
    const program = fixtureProgram({ definition: definition(IDS.a, "solar", null, effect), x: 0, y: 0 });
    const start = prepareExchange([state({ burn: 2 }), state()], [program, EMPTY_PROGRAM], ["strike", "strike"]);
    expect(start.bonus[0]).toBe(2);
    expect(start.heal[0]).toBe(3);
    expect(settleExchange(start, QUIET)[0].burn).toBe(1);
  });

  it("totals all perk kinds at their stars", () => {
    const program = fixtureProgram(
      { definition: definition(IDS.a, "neutral", null, { kind: "perk", perk: "income", amount: [2, 3, 4] }), x: 0, y: 0, stars: 1 },
      { definition: definition(IDS.b, "neutral", null, { kind: "perk", perk: "free-reroll", amount: [1, 2, 3] }), x: 1, y: 0, stars: 2 },
      { definition: definition(IDS.c, "neutral", null, { kind: "perk", perk: "style", amount: [1, 2, 4] }), x: 2, y: 0, stars: 3 },
    );
    expect(staticTotal(program, "income")).toBe(2);
    expect(staticTotal(program, "free-reroll")).toBe(2);
    expect(staticTotal(program, "style")).toBe(4);
  });
});
