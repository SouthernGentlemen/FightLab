import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { OPPONENT_PROGRAM } from "../../src/battle/opponent.ts";
import type { ActionProgram } from "../../src/battle/program.ts";
import { FixedClock, SPEEDS } from "../../src/game/clock.ts";
import type { BattleSpeed } from "../../src/game/clock.ts";
import { DEFAULT_MATCH, Match } from "../../src/game/match.ts";

const FRAME_MS = 1000 / 60;

function match(program: ActionProgram, opponent: ActionProgram = OPPONENT_PROGRAM): Match {
  const created = new Match({ ...DEFAULT_MATCH, opponentProgram: opponent }, program);
  created.fight();
  return created;
}

function play(program: ActionProgram, opponent: ActionProgram = OPPONENT_PROGRAM): Match {
  const running = match(program, opponent);
  for (let guard = 0; !running.over; guard++) {
    if (guard > 200_000) throw new Error(`${program.join(",")} never finished`);
    running.step();
  }
  return running;
}

/** Everything the simulation decides. Presentation counters are left out on purpose. */
function result(finished: Match): unknown {
  return JSON.parse(JSON.stringify({ battle: finished.battle, combat: finished.arena.state, events: finished.events }));
}

function everyProgram(): ActionProgram[] {
  const programs: ActionProgram[] = [];
  const extend = (prefix: readonly (typeof ACTION_TYPES)[number][]): void => {
    if (prefix.length === 5) programs.push(prefix as unknown as ActionProgram);
    else for (const action of ACTION_TYPES) extend([...prefix, action]);
  };
  extend([]);
  return programs;
}

describe("determinism", () => {
  it("gives the same programs from the same start the same match, byte for byte", () => {
    const program: ActionProgram = ["strike", "block", "tech", "strike", "strike"];
    expect(result(play(program))).toEqual(result(play(program)));
  });

  it("changes pacing with battle speed and never the outcome", () => {
    const program: ActionProgram = ["strike", "block", "tech", "strike", "strike"];
    const runs = SPEEDS.map((speed: BattleSpeed) => {
      const running = match(program);
      const clock = new FixedClock();
      let frames = 0;
      while (!running.over) {
        for (let tick = clock.advance(FRAME_MS, speed); tick > 0; tick--) running.step();
        frames++;
        if (frames > 100_000) throw new Error("the match never finished");
      }
      return { frames, result: result(running) };
    });
    for (const run of runs) expect(run.result).toEqual(runs[0].result);
    // Only wall-clock time differs: twice the speed, half the frames.
    expect(Math.abs(runs[1].frames * 2 - runs[0].frames)).toBeLessThanOrEqual(2);
    expect(Math.abs(runs[2].frames * 4 - runs[0].frames)).toBeLessThanOrEqual(4);
  });

  it("ends every one of the 243 possible programs against the opponent, agreeing with the matrix in every exchange", () => {
    const tally = { victory: 0, defeat: 0, draw: 0 };
    for (const program of everyProgram()) {
      const finished = play(program);
      const { history, outcome } = finished.battle;
      expect(history.filter((record) => !record.agrees), program.join(",")).toEqual([]);
      tally[outcome!.result]++;
    }
    // A measurement, not a target: a change to frame data or to the opponent moves these numbers
    // in a diff where someone has to look at them.
    expect(tally).toEqual({ victory: 107, defeat: 117, draw: 19 });
  });

  it("measures the reference matches", () => {
    const strikes = play(["strike", "strike", "strike", "strike", "strike"]);
    expect(strikes.battle.outcome).toMatchObject({ result: "victory", reason: "ko" });
    expect(strikes.battle.history).toHaveLength(11);
    expect(strikes.arena.state.fighters.map((fighter) => fighter.health)).toEqual([24, 0]);

    // Every slot answers the opponent's: a clean sweep.
    const counter = play(["strike", "tech", "block", "strike", "block"]);
    expect(counter.battle.history.every((record) => record.result === "player")).toBe(true);
    expect(counter.arena.state.fighters.map((fighter) => fighter.health)).toEqual([100, 0]);

    // Every slot loses to the opponent's.
    const worst = play(["block", "strike", "tech", "block", "tech"]);
    expect(worst.battle.outcome).toMatchObject({ result: "defeat", reason: "ko" });
    expect(worst.arena.state.fighters.map((fighter) => fighter.health)).toEqual([0, 100]);
  });

  it("ends a loop of guards against guards as a stalemate", () => {
    const blocks: ActionProgram = ["block", "block", "block", "block", "block"];
    const finished = play(blocks, blocks);
    expect(finished.battle.outcome).toMatchObject({ result: "draw", reason: "stalemate" });
    expect(finished.battle.history).toHaveLength(5);
    expect(finished.events.filter((event) => event.kind === "hit")).toHaveLength(0);
  });
});
