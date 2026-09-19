import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { actionBar, actionLoadout, defaultLoadout } from "../../src/battle/bars.ts";
import type { ActionBar, ActionLoadout } from "../../src/battle/bars.ts";
import { REFERENCE_OPPONENT, opponentPlan } from "../../src/battle/mixup.ts";
import type { OpponentPlan } from "../../src/battle/mixup.ts";
import { FixedClock, SPEEDS } from "../../src/game/clock.ts";
import type { BattleSpeed } from "../../src/game/clock.ts";
import { fightFor } from "../../src/game/fight.ts";
import { DEFAULT_MATCH, Match } from "../../src/game/match.ts";
import type { MatchConfig } from "../../src/game/match.ts";
import { buy, beginFight, newRun } from "../../src/run/run.ts";

const FRAME_MS = 1000 / 60;

/** Whether the player mixes up at a pause, decided from what the match shows. */
type Policy = (match: Match) => boolean;
/** Switches after a round in which the opponent won more exchanges. */
const whenBeaten: Policy = (match) => {
  const last = match.battle.rounds.at(-1)!;
  return last.wins[0] < last.wins[1];
};

function match(player: ActionLoadout, opponent: OpponentPlan = REFERENCE_OPPONENT): Match {
  return new Match({ ...DEFAULT_MATCH, player, opponent });
}

/** Runs a fight through the real clock at `speed`, deciding at each pause. */
function clocked(config: MatchConfig, speed: BattleSpeed, policy: Policy) {
  const running = new Match(config);
  const clock = new FixedClock();
  let frames = 0;
  while (!running.over) {
    for (let tick = clock.advance(FRAME_MS, speed); tick > 0 && !running.over; tick--) {
      if (running.paused) decide(running, policy);
      else running.step();
    }
    frames++;
    if (frames > 100_000) throw new Error("the fight never finished");
  }
  return { frames, result: result(running) };
}

function decide(running: Match, policy: Policy): void {
  if (policy(running)) running.mixup();
  running.nextRound();
}

function play(player: ActionLoadout, opponent: OpponentPlan = REFERENCE_OPPONENT, policy: Policy = whenBeaten): Match {
  const running = match(player, opponent);
  for (let guard = 0; !running.over; guard++) {
    if (guard > 200_000) throw new Error(`${player.primary}/${player.secondary} never finished`);
    if (running.paused) decide(running, policy);
    else running.step();
  }
  return running;
}

/** Everything the simulation decides. Presentation counters are left out on purpose. */
function result(finished: Match): unknown {
  return JSON.parse(JSON.stringify({ battle: finished.battle, combat: finished.arena.state, events: finished.events, decisions: finished.decisions }));
}

function everyBar(): ActionBar[] {
  return ACTION_TYPES.flatMap((first) => ACTION_TYPES.flatMap((second) => ACTION_TYPES.map((third) => actionBar(first, second, third))));
}

describe("determinism", () => {
  it("gives the same loadouts and the same decisions the same fight, byte for byte", () => {
    const loadout = actionLoadout(["strike", "block", "tech"], ["tech", "strike", "strike"]);
    expect(result(play(loadout))).toEqual(result(play(loadout)));
  });

  it("changes pacing with battle speed and never the outcome", () => {
    const config = { ...DEFAULT_MATCH, player: actionLoadout(["strike", "block", "tech"], ["block", "tech", "strike"]) };
    const runs = SPEEDS.map((speed: BattleSpeed) => clocked(config, speed, whenBeaten));
    for (const run of runs) expect(run.result).toEqual(runs[0].result);
    // Only wall-clock time differs: twice the speed, about half the frames.
    expect(Math.abs(runs[1].frames * 2 - runs[0].frames)).toBeLessThanOrEqual(8);
    expect(Math.abs(runs[2].frames * 4 - runs[0].frames)).toBeLessThanOrEqual(16);
  });

  it("ends identically at every speed with both grids built and a generated opponent switching bars", () => {
    const run = newRun(606);
    run.day = 7;
    run.money = 40;
    run.shop = { ...run.shop, offers: ["solar-flare", "thunderhead", "null-reservoir", null, null] };
    buy(run, 0, { grid: { x: 0, y: 0, rotation: 0 } });
    buy(run, 1, { grid: { x: 0, y: 1, rotation: 180 } });
    beginFight(run);
    const { config, opponent } = fightFor(run);
    expect(opponent.grid.length).toBeGreaterThan(0);
    const alternate: Policy = (running) => running.battle.round % 2 === 1;
    const runs = SPEEDS.map((speed: BattleSpeed) => clocked(config, speed, alternate));
    for (const each of runs) expect(each.result).toEqual(runs[0].result);
  });

  it("carries health from one round into the next in the real arena", () => {
    const running = match(defaultLoadout());
    while (!running.paused && !running.over) running.step();
    const afterRoundOne = running.arena.state.fighters.map((fighter) => fighter.health);
    const lost = [0, 1].map((side) => running.battle.history.reduce((sum, record) => sum + record.damage[side], 0));
    expect(afterRoundOne).toEqual([100 - lost[0], 100 - lost[1]]);
    running.nextRound();
    while (running.battle.phase === "round-intro") running.step();
    expect(running.arena.state.fighters.map((fighter) => fighter.health)).toEqual(afterRoundOne);
  });

  it("ends every one of the 729 possible loadouts against the reference opponent, agreeing with the matrix in every exchange", () => {
    const tally = { victory: 0, defeat: 0, draw: 0 };
    const bars = everyBar();
    for (const primary of bars) {
      for (const secondary of bars) {
        const finished = play(actionLoadout(primary, secondary));
        const { history, outcome } = finished.battle;
        const disagreements = history.filter((record) => !record.agrees);
        if (disagreements.length > 0) expect(disagreements, `${primary}/${secondary}`).toEqual([]);
        tally[outcome!.result]++;
      }
    }
    // A measurement, not a target: a change to frame data, the rules or the reference opponent moves
    // these numbers in a diff where someone has to look at them.
    expect(tally).toEqual({ victory: 428, defeat: 244, draw: 57 });
  });

  it("measures the reference fight", () => {
    // Bar A answers the reference opponent's first bar slot for slot; its switch to the second bar
    // takes one exchange back, and its switch home again loses the fight. A measurement, like the
    // tally above.
    const finished = play(defaultLoadout());
    expect(finished.battle.outcome).toMatchObject({ result: "victory", reason: "ko", tick: 793 });
    expect(finished.battle.rounds.map((round) => round.wins)).toEqual([[3, 0], [2, 1], [3, 0]]);
    expect(finished.arena.state.fighters.map((fighter) => fighter.health)).toEqual([88, 0]);
    expect(finished.decisions).toEqual([false, false]);
  });

  it("ends a round of guards against guards as a stalemate when nobody switches", () => {
    const blocks = actionLoadout(["block", "block", "block"], ["block", "block", "block"]);
    const walls = opponentPlan({ primary: ["block", "block", "block"], secondary: ["block", "block", "block"] }, { kind: "alternate" });
    const finished = play(blocks, walls);
    expect(finished.battle.outcome).toMatchObject({ result: "draw", reason: "stalemate" });
    expect(finished.battle.history).toHaveLength(3);
    expect(finished.events.filter((event) => event.kind === "hit")).toHaveLength(0);
  });
});
