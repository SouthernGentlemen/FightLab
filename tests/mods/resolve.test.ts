import { describe, expect, it } from "vitest";

import { BASE_CHARGE_CAPACITY, poisonDamage } from "../../src/mods/balance.ts";
import { endRound, freshState, prepareExchange, settleExchange } from "../../src/mods/resolve.ts";
import type { ModState, Pair } from "../../src/mods/resolve.ts";
import { NOTHING, OPPONENT_LANDS, PLAYER_LANDS, QUIET, program, state } from "./programs.ts";

const NONE: Pair<typeof NOTHING> = [NOTHING, NOTHING];
const FRESH: Pair<ModState> = [state(), state()];

describe("resources", () => {
  it("make Heat, more at each star", () => {
    for (const [stars, heat] of [[1, 1], [2, 2], [3, 3]] as const) {
      const prepared = prepareExchange(FRESH, [program(["heat-coil", 0, 0, stars]), NOTHING], ["tech", "tech"]);
      expect(prepared.states[0].heat, `★${stars}`).toBe(heat);
    }
  });

  it("let a consumer spend Heat made in the same exchange, on damage and a Burn that waits for the hit", () => {
    const solar = program(["heat-coil", 0, 0], ["cinder-edge", 0, 1]);
    const prepared = prepareExchange(FRESH, [solar, NOTHING], ["strike", "block"]);
    expect(prepared.states[0].heat).toBe(0);
    expect(prepared.bonus).toEqual([2, 0]);
    expect(prepared.pending[0]).toEqual([{ kind: "debuff", debuff: "burn", amount: 2, needs: "landed" }]);
  });

  it("fire a mod with an action tag only when its fighter plays that action", () => {
    const solar = program(["heat-coil", 0, 0], ["cinder-edge", 0, 1]);
    const teched = prepareExchange(FRESH, [solar, NOTHING], ["tech", "block"]);
    expect(teched.states[0].heat).toBe(1);
    expect(teched.bonus).toEqual([0, 0]);
    expect(teched.pending[0]).toEqual([]);
  });

  it("skip a spend that cannot be paid", () => {
    const prepared = prepareExchange(FRESH, [program(["cinder-edge", 0, 0]), NOTHING], ["strike", "strike"]);
    expect(prepared.bonus).toEqual([0, 0]);
    expect(prepared.pending[0]).toEqual([]);
  });

  it("sink Heat into healing, up to the sink's size", () => {
    const prepared = prepareExchange([state({ heat: 5 }), state()], [program(["basic-sink", 0, 0]), NOTHING], ["block", "strike"]);
    expect(prepared.states[0].heat).toBe(3);
    expect(prepared.heal).toEqual([2, 0]);
  });

  it("store Charge up to capacity, and a Battery raises it", () => {
    const dynamo = program(["arc-dynamo", 0, 0, 3]);
    expect(freshState(dynamo).capacity).toBe(BASE_CHARGE_CAPACITY);
    let states: Pair<ModState> = [freshState(dynamo), state()];
    for (let exchange = 0; exchange < 3; exchange++) states = prepareExchange(states, [dynamo, NOTHING], ["tech", "tech"]).states;
    expect(states[0].charge).toBe(BASE_CHARGE_CAPACITY);
    const stored = program(["arc-dynamo", 0, 0, 3], ["battery-cell", 0, 2]);
    expect(freshState(stored).capacity).toBe(BASE_CHARGE_CAPACITY + 2);
    states = [freshState(stored), state()];
    for (let exchange = 0; exchange < 3; exchange++) states = prepareExchange(states, [stored, NOTHING], ["tech", "tech"]).states;
    expect(states[0].charge).toBe(BASE_CHARGE_CAPACITY + 2);
  });

  it("spend Charge on damage and Shock", () => {
    const prepared = prepareExchange([state({ charge: 1 }), state()], [program(["live-wire", 0, 0]), NOTHING], ["strike", "tech"]);
    expect(prepared.states[0].charge).toBe(0);
    expect(prepared.bonus).toEqual([1, 0]);
    expect(prepared.pending[0]).toEqual([{ kind: "debuff", debuff: "shock", amount: 2, needs: "landed" }]);
  });

  it("leech the opponent's Heat or Charge into Void — only what the opponent has, the larger pool first", () => {
    const prepared = prepareExchange(FRESH, [program(["void-tap", 0, 0, 3]), program(["heat-coil", 0, 0])], ["tech", "tech"]);
    expect(prepared.states[1].heat).toBe(0);
    expect(prepared.states[0].voidCharge).toBe(1);
    const either = prepareExchange([state(), state({ heat: 1, charge: 3 })], [program(["void-tap", 0, 0, 2]), NOTHING], ["tech", "tech"]);
    expect(either.states[1]).toMatchObject({ heat: 1, charge: 1 });
    expect(either.states[0].voidCharge).toBe(2);
  });

  it("leech both ways at once, so the order the fighters are listed in never matters", () => {
    const both = program(["void-tap", 0, 0], ["heat-coil", 0, 1]);
    const prepared = prepareExchange(FRESH, [both, both], ["tech", "strike"]);
    expect(prepared.states[0]).toEqual(prepared.states[1]);
    expect(prepared.states[0]).toMatchObject({ heat: 0, voidCharge: 1 });
  });
});

describe("debuffs", () => {
  it("burn for their stacks and then halve, rounding down, to nothing", () => {
    let states: Pair<ModState> = [state({ burn: 8 }), state()];
    const dealt: number[] = [];
    const left: number[] = [];
    for (let round = 0; round < 5; round++) {
      const ended = endRound(states, NONE);
      dealt.push(ended.afflictions[0]);
      left.push(ended.states[0].burn);
      states = ended.states;
    }
    expect(dealt).toEqual([8, 4, 2, 1, 0]);
    expect(left).toEqual([4, 2, 1, 0, 0]);
  });

  it("amplify the next hit with every Shock stack, and lose all of them to it", () => {
    const prepared = prepareExchange([state({ shock: 4 }), state()], NONE, ["tech", "strike"]);
    expect(prepared.exposure).toEqual([4, 0]);
    expect(settleExchange(prepared, { ...OPPONENT_LANDS, exposed: [4, 0] })[0].shock).toBe(0);
  });

  it("keep Shock through anything that is not a damaging hit", () => {
    const prepared = prepareExchange([state({ shock: 4 }), state()], NONE, ["block", "strike"]);
    expect(settleExchange(prepared, QUIET)[0].shock).toBe(4);
    expect(settleExchange(prepared, PLAYER_LANDS)[0].shock).toBe(4);
  });

  it("poison for half their stacks when a round ends, and never decay", () => {
    expect([1, 2, 3, 4, 6, 10].map(poisonDamage)).toEqual([0, 1, 1, 2, 3, 5]);
    let states: Pair<ModState> = [state(), state({ poison: 6 })];
    for (let round = 0; round < 4; round++) {
      const ended = endRound(states, NONE);
      expect(ended.afflictions[1]).toBe(3);
      states = ended.states;
    }
    expect(states[1].poison).toBe(6);
  });

  it("have no cap", () => {
    const ended = endRound([state({ burn: 1000, poison: 999 }), state()], NONE);
    expect(ended.afflictions[0]).toBe(1000 + 499);
    expect(ended.states[0]).toMatchObject({ burn: 500, poison: 999 });
    const venom = program(["venom-tap", 0, 0, 3]);
    let states: Pair<ModState> = [state({ voidCharge: 500 }), state()];
    for (let exchange = 0; exchange < 400; exchange++) states = settleExchange(prepareExchange(states, [venom, NOTHING], ["strike", "tech"]), PLAYER_LANDS);
    expect(states[1].poison).toBe(1200);
  });

  it("land on the opponent only when the move they rode on lands, and cleanse only when the guard holds", () => {
    const prepared = prepareExchange([state({ heat: 1 }), state()], [program(["cinder-edge", 0, 0]), NOTHING], ["strike", "block"]);
    expect(settleExchange(prepared, QUIET)[1].burn).toBe(0);
    expect(settleExchange(prepared, PLAYER_LANDS)[1].burn).toBe(2);
    const cooled = prepareExchange([state({ heat: 3, burn: 5 }), state()], [program(["cooling-array", 0, 0]), NOTHING], ["block", "strike"]);
    expect(settleExchange(cooled, QUIET)[0].burn).toBe(2);
    expect(settleExchange(cooled, OPPONENT_LANDS)[0].burn).toBe(5);
  });

  it("vent half the Heat at the end of a round, keep Charge and Void, and let Void accrue", () => {
    const reservoir = program(["null-reservoir", 0, 0, 2]);
    const ended = endRound([state({ heat: 5, charge: 3, voidCharge: 4 }), state()], [reservoir, NOTHING]);
    expect(ended.states[0]).toMatchObject({ heat: 2, charge: 3, voidCharge: 4 + 2 });
  });
});
