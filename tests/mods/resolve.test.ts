import { describe, expect, it } from "vitest";

import { poisonDamage } from "../../src/mods/balance.ts";
import { endRound, prepareExchange, settleExchange } from "../../src/mods/resolve.ts";
import type { ModState, Pair } from "../../src/mods/resolve.ts";
import { NOTHING, OPPONENT_LANDS, PLAYER_LANDS, QUIET, state } from "./programs.ts";

const NONE: Pair<typeof NOTHING> = [NOTHING, NOTHING];

describe("statuses", () => {
  it("Burn deals its stacks and halves to zero", () => {
    let states: Pair<ModState> = [state({ burn: 8 }), state()];
    const dealt: number[] = [];
    const left: number[] = [];
    for (let round = 0; round < 5; round++) {
      const ended = endRound(states);
      dealt.push(ended.afflictions[0]);
      left.push(ended.states[0].burn);
      states = ended.states;
    }
    expect(dealt).toEqual([8, 4, 2, 1, 0]);
    expect(left).toEqual([4, 2, 1, 0, 0]);
  });

  it("one landed hit consumes every Shock stack", () => {
    const prepared = prepareExchange([state({ shock: 4 }), state()], NONE, ["tech", "strike"]);
    expect(prepared.exposure).toEqual([4, 0]);
    expect(settleExchange(prepared, { ...OPPONENT_LANDS, exposed: [4, 0] })[0].shock).toBe(0);
  });

  it("Shock persists when no damaging hit consumes it", () => {
    const prepared = prepareExchange([state({ shock: 4 }), state()], NONE, ["block", "strike"]);
    expect(settleExchange(prepared, QUIET)[0].shock).toBe(4);
    expect(settleExchange(prepared, PLAYER_LANDS)[0].shock).toBe(4);
  });

  it("Poison deals half its stacks and persists", () => {
    expect([1, 2, 3, 4, 6, 10].map(poisonDamage)).toEqual([0, 1, 1, 2, 3, 5]);
    let states: Pair<ModState> = [state(), state({ poison: 6 })];
    for (let round = 0; round < 4; round++) {
      const ended = endRound(states);
      expect(ended.afflictions[1]).toBe(3);
      states = ended.states;
    }
    expect(states[1].poison).toBe(6);
  });

  it("status stacks have no cap", () => {
    const ended = endRound([state({ burn: 1000, poison: 999 }), state()]);
    expect(ended.afflictions[0]).toBe(1000 + 499);
    expect(ended.states[0]).toMatchObject({ burn: 500, poison: 999 });
    expect(state({ burn: 10_000, shock: 20_000, poison: 30_000 })).toEqual({
      burn: 10_000,
      shock: 20_000,
      poison: 30_000,
    });
  });
});
