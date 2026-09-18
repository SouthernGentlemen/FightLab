import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { actionLoadout } from "../../src/battle/bars.ts";
import { opponentPlan } from "../../src/battle/mixup.ts";
import { playFight } from "../../src/game/fight.ts";
import { DEFAULT_MATCH, Match } from "../../src/game/match.ts";
import type { MatchConfig } from "../../src/game/match.ts";
import { combatSide } from "../../src/game/sides.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid } from "../../src/mods/grid.ts";
import type { ModId } from "../../src/mods/registry.ts";
import type { Rotation } from "../../src/mods/shapes.ts";

let uid = 0;
function grid(...pieces: ReadonlyArray<readonly [ModId, number, number, Rotation?]>): Grid {
  return pieces.reduce<Grid>((built, [mod, x, y, rotation = 0]) => place(built, { uid: ++uid, mod, stars: 1, rotation, x, y })!, []);
}

const all = (action: ActionType) => actionLoadout([action, action, action], [action, action, action]);

/** The player's grid and bars against an opponent's, both steady, through the real director, engine and kernel. */
function config(mine: Grid, theirs: Grid, player: ActionType, opponent: ActionType): MatchConfig {
  const builds = [compileBuild(mine), compileBuild(theirs)] as const;
  return {
    ...DEFAULT_MATCH,
    sides: [combatSide(builds[0]), combatSide(builds[1])],
    programs: [builds[0].program, builds[1].program],
    player: all(player),
    opponent: opponentPlan(all(opponent), { kind: "steady" }),
  };
}

function untilPause(match: Match): void {
  for (let guard = 0; !match.paused && !match.over && guard < 100_000; guard++) match.step();
}

describe("mods in a real fight", () => {
  it("Solar: Heat becomes Burn on landed strikes, burns when the round ends, then halves", () => {
    const match = new Match(config(grid(["heat-coil", 0, 0], ["cinder-edge", 1, 0]), [], "strike", "tech"));
    untilPause(match);
    // Three landed strikes put 2 Burn each on the opponent; the round's end burns all 6 and halves it.
    expect(match.battle.rounds[0].afflictions).toEqual([0, 6]);
    expect(match.mods.states[1].burn).toBe(3);
    expect(match.events.filter((event) => event.kind === "afflicted")).toMatchObject([{ fighter: "opponent", detail: "-6 health" }]);
    const lost = match.battle.history.reduce((sum, record) => sum + record.damage[1], 0);
    expect(match.arena.state.fighters[1].health).toBe(100 - lost - 6);
  });

  it("Arc: stored Charge becomes Shock, and the next landed hit takes every stack at once", () => {
    const match = new Match(config(grid(["arc-dynamo", 0, 0], ["battery-cell", 1, 0], ["storm-cell", 0, 1]), [], "strike", "tech"));
    untilPause(match);
    const [first, second] = match.battle.history;
    expect(second.damage[1] - first.damage[1]).toBe(4);
    // The third hit consumed the four stacks the second strike's Storm Cell put back, then left four more.
    expect(match.mods.states[1].shock).toBe(4);
  });

  it("Void: leeched energy becomes Poison that stays and grows round after round", () => {
    // Down in the Block row the pair adds nothing to the strikes, so the fight lasts long enough to watch Poison build.
    const match = new Match(config(grid(["void-tap", 0, 2], ["venom-tap", 1, 2]), grid(["heat-coil", 0, 0], ["arc-dynamo", 0, 1]), "strike", "tech"));
    const poison: number[] = [];
    const dealt: number[] = [];
    for (let round = 0; round < 3; round++) {
      untilPause(match);
      if (!match.paused) break;
      poison.push(match.mods.states[1].poison);
      dealt.push(match.battle.rounds.at(-1)!.afflictions[1]);
      match.nextRound();
    }
    expect(poison.length).toBeGreaterThan(1);
    for (let index = 1; index < poison.length; index++) {
      expect(poison[index]).toBeGreaterThan(poison[index - 1]);
      expect(dealt[index]).toBeGreaterThanOrEqual(dealt[index - 1]);
    }
  });

  it("plays the same modded fight, engine state and all, from the same inputs", () => {
    const setup = config(grid(["solar-flare", 0, 0], ["void-tap", 0, 2]), grid(["live-wire", 0, 0], ["arc-dynamo", 2, 0]), "strike", "block");
    const everyOther = (running: Match) => running.battle.round % 2 === 1;
    const [a, b] = [playFight(setup, everyOther), playFight(setup, everyOther)];
    expect(JSON.stringify([a.battle, a.arena.state, a.events, a.mods.states])).toBe(JSON.stringify([b.battle, b.arena.state, b.events, b.mods.states]));
  });
});
