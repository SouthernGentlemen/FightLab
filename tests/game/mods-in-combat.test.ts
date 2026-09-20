import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { actionLoadout } from "../../src/battle/bars.ts";
import { opponentPlan } from "../../src/battle/mixup.ts";
import { playFight } from "../../src/game/fight.ts";
import { DEFAULT_MATCH, Match } from "../../src/game/match.ts";
import type { MatchConfig } from "../../src/game/match.ts";
import { combatSide } from "../../src/game/sides.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import {
  LEGACY_BATTERY, LEGACY_CINDER, LEGACY_DYNAMO, LEGACY_FLARE, LEGACY_HEAT,
  LEGACY_STORM, LEGACY_VENOM, LEGACY_VOID_TAP, LEGACY_WIRE, legacyGrid,
} from "../mods/legacy-fixtures.ts";
import type { LegacyPiece } from "../mods/legacy-fixtures.ts";

type FixtureGrid = ReturnType<typeof legacyGrid>;
const built = (...pieces: readonly LegacyPiece[]): FixtureGrid => legacyGrid(...pieces);

const all = (action: ActionType) => actionLoadout([action, action, action], [action, action, action]);

/** The player's grid and bars against an opponent's, both steady, through the real director, engine and kernel. */
function config(mine: FixtureGrid, theirs: FixtureGrid, player: ActionType, opponent: ActionType): MatchConfig {
  const builds = [
    compileBuild(mine.grid, mine.definitions),
    compileBuild(theirs.grid, theirs.definitions),
  ] as const;
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
    const match = new Match(config(built([LEGACY_HEAT, 0, 0], [LEGACY_CINDER, 1, 0]), built(), "strike", "tech"));
    untilPause(match);
    // Three landed strikes put 2 Burn each on the opponent; the round's end burns all 6 and halves it.
    expect(match.battle.rounds[0].afflictions).toEqual([0, 6]);
    expect(match.mods.states[1].burn).toBe(3);
    expect(match.events.filter((event) => event.kind === "afflicted")).toMatchObject([{ fighter: "opponent", detail: "-6 health" }]);
    const lost = match.battle.history.reduce((sum, record) => sum + record.damage[1], 0);
    expect(match.arena.state.fighters[1].health).toBe(100 - lost - 6);
  });

  it("Arc: stored Charge becomes Shock, and the next landed hit takes every stack at once", () => {
    const match = new Match(config(built([LEGACY_DYNAMO, 0, 0], [LEGACY_BATTERY, 1, 0], [LEGACY_STORM, 0, 1]), built(), "strike", "tech"));
    untilPause(match);
    const [first, second, third] = match.battle.history;
    expect(second.damage[1] - first.damage[1]).toBe(0);
    expect(third.damage[1] - second.damage[1]).toBe(4);
    // Without the old producer bonus, Storm Cell pays on the second strike; the third consumes those stacks.
    expect(match.mods.states[1].shock).toBe(0);
  });

  it("Void: leeched energy becomes Poison that stays and grows round after round", () => {
    // Down in the Block row the pair adds nothing to the strikes, so the fight lasts long enough to watch Poison build.
    const match = new Match(config(built([LEGACY_VOID_TAP, 0, 2], [LEGACY_VENOM, 1, 2]), built([LEGACY_HEAT, 0, 0], [LEGACY_DYNAMO, 0, 1]), "strike", "tech"));
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
    const setup = config(built([LEGACY_FLARE, 0, 0], [LEGACY_VOID_TAP, 0, 2]), built([LEGACY_WIRE, 0, 0], [LEGACY_DYNAMO, 2, 0]), "strike", "block");
    const everyOther = (running: Match) => running.battle.round % 2 === 1;
    const [a, b] = [playFight(setup, everyOther), playFight(setup, everyOther)];
    expect(JSON.stringify([a.battle, a.arena.state, a.events, a.mods.states])).toBe(JSON.stringify([b.battle, b.arena.state, b.events, b.mods.states]));
  });
});
