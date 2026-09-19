import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { LINK_BONUS } from "../../src/mods/balance.ts";
import type { ModProgram } from "../../src/mods/program.ts";
import { endRound, freshState, prepareExchange, settleExchange } from "../../src/mods/resolve.ts";
import type { ModState, Outcome, Pair } from "../../src/mods/resolve.ts";
import { NOTHING, PLAYER_LANDS, QUIET, program, state } from "./programs.ts";

/** One exchange through steps 1–3 and 5, with the kernel's part (step 4) given as its outcome. */
function exchange(states: Pair<ModState>, programs: Pair<ModProgram>, actions: Pair<ActionType>, outcome: Outcome = QUIET) {
  const prepared = prepareExchange(states, programs, actions);
  return { prepared, states: settleExchange(prepared, outcome) };
}

describe("Solar: fast build, low sustained payoff", () => {
  it("generates Heat, spends it on a burning Strike, and the Burn halves away after the round", () => {
    // The coil's out-port faces the edge's in-port, so it makes one more Heat than it would alone.
    const solar = program(["heat-coil", 0, 0], ["cinder-edge", 1, 0]);
    const first = exchange([freshState(solar), state()], [solar, NOTHING], ["strike", "tech"], PLAYER_LANDS);
    expect(first.prepared.states[0].heat).toBe(1 + LINK_BONUS - 1);
    expect(first.prepared.bonus[0]).toBe(2);
    expect(first.states[1].burn).toBe(2);
    const round = endRound(first.states, [solar, NOTHING]);
    expect(round.afflictions).toEqual([0, 2]);
    expect(round.states[1].burn).toBe(1);
    expect(endRound(round.states, [solar, NOTHING]).states[1].burn).toBe(0);
  });
});

describe("Arc: setup and burst", () => {
  it("stores Charge, spends it on Shock, and one hit takes the whole Shock at once", () => {
    const arc = program(["arc-dynamo", 0, 0], ["battery-cell", 1, 0], ["storm-cell", 0, 1]);
    let states: Pair<ModState> = [freshState(arc), state()];
    expect(states[0].capacity).toBe(5);
    states = exchange(states, [arc, NOTHING], ["tech", "tech"]).states;
    expect(states[0].charge).toBe(1 + LINK_BONUS);
    states = exchange(states, [arc, NOTHING], ["tech", "tech"]).states;
    expect(states[0].charge).toBe(4);
    const burst = exchange(states, [arc, NOTHING], ["strike", "tech"], PLAYER_LANDS);
    expect(burst.prepared.states[0].charge).toBe(5 - 2);
    expect(burst.states[1].shock).toBe(4);
    // The next damaging hit on the opponent carries all four stacks and leaves none.
    const hit = prepareExchange(burst.states, [NOTHING, NOTHING], ["strike", "tech"]);
    expect(hit.exposure).toEqual([0, 4]);
    expect(settleExchange(hit, { ...PLAYER_LANDS, exposed: [0, 4] })[1].shock).toBe(0);
  });
});

describe("Void: slow build, persistent high payoff", () => {
  it("leeches into Void, spends it on Poison, and the Poison stays and grows through the rounds", () => {
    const leecher = program(["void-tap", 0, 0], ["venom-tap", 1, 0]);
    const foe = program(["heat-coil", 0, 0], ["arc-dynamo", 0, 1]);
    let states: Pair<ModState> = [freshState(leecher), freshState(foe)];
    const poisonDealt: number[] = [];
    for (let round = 0; round < 4; round++) {
      for (let slot = 0; slot < 3; slot++) states = exchange(states, [leecher, foe], ["strike", "tech"], PLAYER_LANDS).states;
      const ended = endRound(states, [leecher, foe]);
      poisonDealt.push(ended.poison[1]);
      expect(ended.states[1].poison).toBe(states[1].poison);
      states = ended.states;
    }
    expect(states[1].poison).toBe(12);
    // Weak early, dangerous late.
    expect(poisonDealt).toEqual([1, 3, 4, 6]);
  });
});

describe("stars, rotation and tags", () => {
  it("scale a mod's own numbers with its stars", () => {
    const at = (stars: 1 | 2 | 3) => prepareExchange([state({ heat: 1 }), state()], [program(["cinder-edge", 0, 0, stars]), NOTHING], ["strike", "tech"]);
    expect([1, 2, 3].map((stars) => at(stars as 1 | 2 | 3).bonus[0])).toEqual([2, 3, 4]);
    expect([1, 2, 3].map((stars) => at(stars as 1 | 2 | 3).pending[0][0].amount)).toEqual([2, 3, 5]);
  });

  it("feed a neighbour only while the port faces it", () => {
    const facing = program(["heat-coil", 0, 0, 1, 0], ["cinder-edge", 1, 0]);
    const turned = program(["heat-coil", 0, 0, 1, 180], ["cinder-edge", 1, 0]);
    const heat = (built: ModProgram) => prepareExchange([state(), state()], [built, NOTHING], ["tech", "tech"]).states[0].heat;
    expect(heat(facing)).toBe(1 + LINK_BONUS);
    expect(heat(turned)).toBe(1);
  });

  it("let Chain Circuit make more Charge for every link", () => {
    // The dynamo turned to face down feeds the circuit's first cell from above.
    const alone = program(["chain-circuit", 0, 1]);
    const chained = program(["arc-dynamo", 0, 0, 1, 90], ["chain-circuit", 0, 1]);
    const circuit = chained.mods.find((mod) => mod.definition.id === "chain-circuit")!;
    expect(circuit.links).toBe(1);
    const charge = (built: ModProgram) => prepareExchange([state({ capacity: 99 }), state()], [built, NOTHING], ["tech", "tech"]).states[0].charge;
    expect(charge(alone)).toBe(1);
    expect(charge(chained)).toBe((1 + LINK_BONUS) + (1 + 1));
  });

  it("refund Charge through a Feedback Loop when a linked mod spends it", () => {
    const loop = program(["arc-dynamo", 0, 0], ["feedback-loop", 1, 0], ["capacitor-guard", 2, 0]);
    const blocked = prepareExchange([freshState(loop), state()], [loop, NOTHING], ["block", "strike"]);
    expect(blocked.heal[0]).toBe(3);
    expect(blocked.states[0].charge).toBe(1 + LINK_BONUS - 2 + 1);
    const struck = prepareExchange([freshState(loop), state()], [loop, NOTHING], ["strike", "strike"]);
    expect(struck.states[0].charge).toBe(1 + LINK_BONUS);
  });
});
