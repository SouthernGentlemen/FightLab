import { RULES } from "../battle/director.ts";
import type { BattleRules } from "../battle/director.ts";
import { compileBuild } from "../mods/compile.ts";
import { opponentOf } from "../run/run.ts";
import type { FightReport, RunState } from "../run/run.ts";
import type { Opponent } from "../run/opponents.ts";
import { Match } from "./match.ts";
import type { MatchConfig } from "./match.ts";
import { combatSide } from "./sides.ts";

export interface DayFight {
  readonly opponent: Opponent;
  readonly config: MatchConfig;
}

/** The day's fight: the player's bars and compiled grid against the opponent the seed made for today. */
export function fightFor(run: RunState, rules: BattleRules = RULES): DayFight {
  const opponent = opponentOf(run);
  const builds = [compileBuild(run.grid), compileBuild(opponent.grid)] as const;
  return {
    opponent,
    config: {
      sides: [combatSide(builds[0]), combatSide(builds[1])],
      programs: [builds[0].program, builds[1].program],
      player: run.loadout,
      opponent: opponent.plan,
      rules,
    },
  };
}

/** Whether the player mixes up at a pause. */
export type MixupPolicy = (match: Match) => boolean;

/** A whole fight, headless: for tests, the bot and anything else that does not watch. */
export function playFight(config: MatchConfig, policy: MixupPolicy, guard = 1_000_000): Match {
  const match = new Match(config);
  for (let ticks = 0; !match.over; ticks++) {
    if (ticks > guard) throw new Error("the fight never ended");
    if (match.paused) {
      if (policy(match)) match.mixup();
      match.nextRound();
    } else {
      match.step();
    }
  }
  return match;
}

/**
 * A fight rebuilt from the decisions made in it so far: every round they settled is replayed
 * headlessly, and the match is handed back at the start of the round after the last one — so a
 * reload re-watches the round in progress instead of re-rolling anything.
 */
export function resumeFight(config: MatchConfig, decisions: readonly boolean[]): Match {
  const match = new Match(config);
  for (const decision of decisions) {
    while (!match.paused && !match.over) match.step();
    if (match.over) break;
    if (decision) match.mixup();
    match.nextRound();
  }
  return match;
}

export function reportOf(match: Match): FightReport {
  const { outcome, round } = match.battle;
  if (outcome === null) throw new Error("the fight is not over");
  return { result: outcome.result, reason: outcome.reason, peakStyle: match.style()[0].peak, rounds: round };
}
