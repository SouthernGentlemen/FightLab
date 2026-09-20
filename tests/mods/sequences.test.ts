import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import type { ModEffect } from "../../src/mods/effects.ts";
import { programOf } from "../../src/mods/program.ts";
import type { ModProgram } from "../../src/mods/program.ts";
import type { ModDefinition, ModId } from "../../src/mods/registry.ts";
import { endRound, prepareExchange, settleExchange } from "../../src/mods/resolve.ts";
import type { ModState, Outcome, Pair } from "../../src/mods/resolve.ts";
import { pick } from "./fixtures.ts";
import { NOTHING, PLAYER_LANDS, QUIET, state } from "./programs.ts";

function fixture(type: "solar" | "arc" | "void", effect: ModEffect): ModProgram {
  const base = pick({ type, affinity: "strike", size: 2 });
  const definition: ModDefinition = { ...base, effect };
  return programOf(
    [{ uid: 1, mod: base.id, stars: 1, rotation: 0, x: 0, y: 0 }],
    { [base.id]: definition } as Partial<Record<ModId, ModDefinition>>,
  );
}

function exchange(
  states: Pair<ModState>,
  programs: Pair<ModProgram>,
  actions: Pair<ActionType>,
  outcome: Outcome = QUIET,
) {
  const prepared = prepareExchange(states, programs, actions);
  return { prepared, states: settleExchange(prepared, outcome) };
}

describe("status sequences", () => {
  it("Solar applies Burn that damages and halves after the round", () => {
    const solar = fixture("solar", {
      kind: "exchange",
      payoffs: [{ kind: "status", amount: { value: [2, 2, 2], per: "flat" } }],
    });
    const fought = exchange([state(), state()], [solar, NOTHING], ["strike", "tech"], PLAYER_LANDS);
    expect(fought.states[1].burn).toBe(2);
    const round = endRound(fought.states);
    expect(round.afflictions).toEqual([0, 2]);
    expect(round.states[1].burn).toBe(1);
  });

  it("Arc applies Shock and the next landed hit consumes all of it", () => {
    const arc = fixture("arc", {
      kind: "exchange",
      payoffs: [{ kind: "status", amount: { value: [4, 4, 4], per: "flat" } }],
    });
    const first = exchange([state(), state()], [arc, NOTHING], ["strike", "tech"], PLAYER_LANDS);
    expect(first.states[1].shock).toBe(4);
    const next = prepareExchange(first.states, [NOTHING, NOTHING], ["strike", "tech"]);
    expect(next.exposure).toEqual([0, 4]);
    expect(settleExchange(next, { ...PLAYER_LANDS, exposed: [0, 4] })[1].shock).toBe(0);
  });

  it("Void applies persistent Poison", () => {
    const voidProgram = fixture("void", {
      kind: "exchange",
      payoffs: [{ kind: "status", amount: { value: [6, 6, 6], per: "flat" } }],
    });
    const fought = exchange([state(), state()], [voidProgram, NOTHING], ["strike", "tech"], PLAYER_LANDS);
    expect(fought.states[1].poison).toBe(6);
    const round = endRound(fought.states);
    expect(round.poison[1]).toBe(3);
    expect(round.states[1].poison).toBe(6);
  });
});
