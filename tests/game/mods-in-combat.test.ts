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
import type { PickedMod } from "../mods/fixtures.ts";
import { pick } from "../mods/fixtures.ts";

const SOLAR = pick({ type: "solar", affinity: "tech", rarity: "uncommon", size: 3 });
const ARC = pick({ type: "arc", affinity: "strike", rarity: "common", size: 2 });
const VOID = pick({ type: "void", affinity: "strike", rarity: "common", size: 2 });
const SOLAR_STRIKE = pick({ type: "solar", affinity: "strike", rarity: "common", size: 2 });
const ARC_STRIKE = pick({ type: "arc", affinity: "strike", rarity: "uncommon", size: 2 });

let uid = 0;
function grid(...pieces: ReadonlyArray<readonly [PickedMod, number, number]>): Grid {
  let built: Grid = [];
  for (const [definition, x, y] of pieces) {
    const next = place(built, { uid: ++uid, mod: definition.id, stars: 1, rotation: 0, x, y });
    if (next === null) throw new Error(`${definition.id} does not fit at ${x},${y}`);
    built = next;
  }
  return built;
}

const all = (action: ActionType) => actionLoadout([action, action, action], [action, action, action]);

/** The player's grid and bars against an opponent's, both steady, through the real engine and kernel. */
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
  it("Solar applies Burn on landed moves, then Burn damages and halves", () => {
    const match = new Match(config(grid([SOLAR, 0, 0]), [], "tech", "block"));
    untilPause(match);

    expect(match.battle.rounds[0].afflictions).toEqual([0, 3]);
    expect(match.mods.states[1].burn).toBe(1);
    expect(match.events.filter((event) => event.kind === "afflicted"))
      .toMatchObject([{ fighter: "opponent", detail: "-3 health" }]);
  });

  it("Arc applies Shock and the next landed hit consumes all existing stacks", () => {
    const match = new Match(config(grid([ARC, 0, 0]), [], "strike", "tech"));
    untilPause(match);
    const [first, second, third] = match.battle.history;

    expect(second.damage[1] - first.damage[1]).toBe(2);
    expect(third.damage[1] - second.damage[1]).toBe(0);
    expect(match.mods.states[1].shock).toBe(2);
  });

  it("Void applies Poison that damages and persists after the round", () => {
    const match = new Match(config(grid([VOID, 0, 0]), [], "strike", "tech"));
    untilPause(match);

    expect(match.battle.rounds[0].afflictions).toEqual([0, 3]);
    expect(match.mods.states[1].poison).toBe(6);
  });

  it("plays the same modded fight, engine state and all, from the same inputs", () => {
    const setup = config(
      grid([SOLAR_STRIKE, 0, 0], [VOID, 0, 2]),
      grid([ARC_STRIKE, 0, 0]),
      "strike",
      "block",
    );
    const everyOther = (running: Match) => running.battle.round % 2 === 1;
    const [a, b] = [playFight(setup, everyOther), playFight(setup, everyOther)];
    expect(JSON.stringify([a.battle, a.arena.state, a.events, a.mods.states]))
      .toBe(JSON.stringify([b.battle, b.arena.state, b.events, b.mods.states]));
  });
});
