import { describe, expect, it } from "vitest";

import { pick } from "../mods/fixtures.ts";
import { STARTING_MONEY } from "../../src/run/economy.ts";
import {
  RUN_HEARTS, TROPHIES_TO_WIN, beginFight, buy, finishFight, move, newRun, nextDay, reroll, rotate, sell, setAction, toggleLock,
} from "../../src/run/run.ts";
import type { FightReport, RunState } from "../../src/run/run.ts";

const SEED = 20260918;
const SINGLE = pick({ size: 1 });
const WIN: FightReport = { result: "victory", reason: "ko", peakStyle: 2, rounds: 3 };
const LOSS: FightReport = { result: "defeat", reason: "ko", peakStyle: 0, rounds: 4 };
const DRAW: FightReport = { result: "draw", reason: "stalemate", peakStyle: 0, rounds: 2 };

function stocked(): RunState {
  const run = newRun(SEED);
  run.shop = { ...run.shop, offers: [SINGLE.id, SINGLE.id, null, null, null] };
  return run;
}

function playDay(run: RunState, report: FightReport): void {
  expect(beginFight(run)).toBeNull();
  expect(finishFight(run, report)).toBeNull();
}

describe("the run day", () => {
  it("programs either bar in prep only", () => {
    const run = newRun(SEED);
    expect(setAction(run, "secondary", 0, "tech")).toBeNull();
    expect(run.loadout.secondary).toEqual(["tech", "block", "strike"]);
    beginFight(run);
    expect(setAction(run, "primary", 0, "block")).toBe("wrong-phase");
    expect(run.loadout.primary[0]).toBe("strike");
    expect(() => setAction(newRun(SEED), "primary", 3, "tech")).toThrow(RangeError);
  });

  it("locks every prep action once the fight begins", () => {
    const run = stocked();
    buy(run, 0);
    expect(beginFight(run)).toBeNull();
    expect(run).toMatchObject({ phase: "fight", stake: run.money });
    const before = structuredClone(run);
    expect(buy(run, 1)).toBe("wrong-phase");
    expect(sell(run, { bank: 0 })).toBe("wrong-phase");
    expect(move(run, { bank: 0 }, { bank: 1 })).toBe("wrong-phase");
    expect(rotate(run, { bank: 0 })).toBe("wrong-phase");
    expect(reroll(run)).toBe("wrong-phase");
    expect(toggleLock(run)).toBe("wrong-phase");
    expect(beginFight(run)).toBe("wrong-phase");
    expect(nextDay(run)).toBe("wrong-phase");
    expect(run).toEqual(before);
  });

  it("pays out after a win, with interest on the money held when the fight began", () => {
    const run = newRun(SEED);
    run.money = 12;
    playDay(run, WIN);
    expect(run.phase).toBe("payday");
    expect(run.trophies).toBe(1);
    expect(run.hearts).toBe(RUN_HEARTS);
    expect(run.last).toMatchObject({ day: 1, result: "victory", earned: 11 });
    expect(run.money).toBe(23);
    expect(run.record).toEqual({ wins: 1, losses: 0, draws: 0, bestStyle: 2 });
    expect(run.stake).toBeNull();
  });

  it("takes a heart for a defeat and nothing for a draw", () => {
    const run = newRun(SEED);
    playDay(run, LOSS);
    expect([run.hearts, run.trophies, run.money]).toEqual([RUN_HEARTS - 1, 0, STARTING_MONEY + 7]);
    nextDay(run);
    playDay(run, DRAW);
    expect([run.hearts, run.trophies]).toEqual([RUN_HEARTS - 1, 0]);
    expect(run.record).toEqual({ wins: 0, losses: 1, draws: 1, bestStyle: 0 });
    expect(run.day).toBe(2);
  });

  it("ends as Champion on the tenth trophy and Knocked out on the last heart", () => {
    const champion = newRun(SEED);
    for (let day = 1; day <= TROPHIES_TO_WIN; day++) {
      playDay(champion, WIN);
      if (day < TROPHIES_TO_WIN) expect(nextDay(champion)).toBeNull();
    }
    expect(champion).toMatchObject({ phase: "over", ending: "champion", trophies: 10, day: 10 });
    expect(nextDay(champion)).toBe("wrong-phase");

    const beaten = newRun(SEED);
    for (let day = 1; day <= RUN_HEARTS; day++) {
      playDay(beaten, LOSS);
      if (day < RUN_HEARTS) nextDay(beaten);
    }
    expect(beaten).toMatchObject({ phase: "over", ending: "knocked-out", hearts: 0 });
    expect(beginFight(beaten)).toBe("wrong-phase");
  });

  it("refuses to finish a fight that never began", () => {
    expect(finishFight(newRun(SEED), WIN)).toBe("wrong-phase");
  });
});

describe("a run replayed", () => {
  it("reaches the same state from the same seed and the same choices", () => {
    const choices = (run: RunState) => {
      buy(run, 0);
      reroll(run);
      buy(run, 2, { grid: { x: 0, y: 0, rotation: 0 } });
      setAction(run, "primary", 1, "strike");
      playDay(run, WIN);
      nextDay(run);
      reroll(run);
      buy(run, 1);
      playDay(run, LOSS);
      nextDay(run);
    };
    const first = newRun(4242);
    const second = newRun(4242);
    choices(first);
    choices(second);
    expect(second).toEqual(first);
  });
});
