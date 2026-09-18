import { describe, expect, it } from "vitest";

import { defaultLoadout } from "../../src/battle/bars.ts";
import { CATALOG } from "../../src/mods/catalog.ts";
import type { ModId } from "../../src/mods/catalog.ts";
import { STARTING_MONEY, sellValue } from "../../src/run/economy.ts";
import {
  RUN_HEARTS, TROPHIES_TO_WIN, beginFight, buy, finishFight, move, newRun, nextDay, opponentOf, rerollPrice, reroll, rotate, sell,
  setAction, toggleLock,
} from "../../src/run/run.ts";
import type { FightReport, RunState } from "../../src/run/run.ts";
import { opponentFor } from "../../src/run/opponents.ts";
import { REROLL_PRICE, rollOffers } from "../../src/run/shop.ts";

const SEED = 20260918;

/** A run whose shop holds exactly these offers, and money enough to buy them. */
function stocked(offers: ReadonlyArray<ModId | null>, money = 50): RunState {
  const run = newRun(SEED);
  run.shop = { ...run.shop, offers: Object.freeze([...offers]) };
  run.money = money;
  return run;
}

const WIN: FightReport = { result: "victory", reason: "ko", peakStyle: 2, rounds: 3 };
const LOSS: FightReport = { result: "defeat", reason: "ko", peakStyle: 0, rounds: 4 };
const DRAW: FightReport = { result: "draw", reason: "stalemate", peakStyle: 0, rounds: 2 };

function playDay(run: RunState, report: FightReport): void {
  expect(beginFight(run)).toBeNull();
  expect(finishFight(run, report)).toBeNull();
}

describe("a new run", () => {
  it("starts on day 1 in prep with five hearts, no trophies, $10, the default bars and an empty build", () => {
    const run = newRun(SEED);
    expect(run).toMatchObject({
      seed: SEED, day: 1, phase: "prep", hearts: RUN_HEARTS, trophies: 0, money: STARTING_MONEY, grid: [], bank: [null, null, null, null],
      stake: null, last: null, ending: null, record: { wins: 0, losses: 0, draws: 0, bestStyle: 0 },
    });
    expect(run.loadout).toEqual(defaultLoadout());
    expect(run.shop).toEqual({ offers: rollOffers(SEED, 1, 0), locked: false, rerolls: 0 });
    expect(RUN_HEARTS).toBe(5);
    expect(TROPHIES_TO_WIN).toBe(10);
  });

  it("meets the day's opponent from the seed alone", () => {
    const run = newRun(SEED);
    expect(opponentOf(run)).toEqual(opponentFor(SEED, 1));
    reroll(run);
    buy(run, 0);
    expect(opponentOf(run)).toEqual(opponentFor(SEED, 1));
  });
});

describe("buying", () => {
  it("puts a mod in the first free bank slot, charges for it and sells out the offer", () => {
    const run = stocked(["ember", "static", null, "corona", "coil"]);
    expect(buy(run, 1)).toBeNull();
    expect(run.bank[0]).toEqual({ uid: 1, mod: "static", rotation: 0 });
    expect(run.money).toBe(50 - CATALOG.static.price);
    expect(run.shop.offers).toEqual(["ember", null, null, "corona", "coil"]);
    expect(buy(run, 0)).toBeNull();
    expect(run.bank[1]).toEqual({ uid: 2, mod: "ember", rotation: 0 });
    expect(run.nextUid).toBe(3);
  });

  it("drops a mod straight onto the grid when the placement is legal", () => {
    const run = stocked(["static", "ember", null, null, null]);
    expect(buy(run, 0, { grid: { x: 0, y: 0, rotation: 1 } })).toBeNull();
    expect(run.grid).toEqual([{ uid: 1, mod: "static", rotation: 1, x: 0, y: 0 }]);
    expect(buy(run, 1, { grid: { x: 0, y: 1, rotation: 0 } })).toBe("blocked");
    expect(run.shop.offers[1]).toBe("ember");
    expect(run.money).toBe(50 - CATALOG.static.price);
  });

  it("refuses what it cannot afford, what is sold out, and what has nowhere to go", () => {
    const poor = stocked(["corona", null, "ember", "ember", "ember"], 6);
    expect(buy(poor, 0)).toBe("cannot-afford");
    expect(buy(poor, 1)).toBe("sold-out");
    const full = stocked(["ember", "ember", "ember", "ember", "ember"]);
    for (let offer = 0; offer < 4; offer++) expect(buy(full, offer)).toBeNull();
    const before = structuredClone(full);
    expect(buy(full, 4)).toBe("no-room");
    expect(buy(full, 4, { bank: 2 })).toBe("blocked");
    expect(full).toEqual(before);
    expect(() => buy(full, 5)).toThrow(RangeError);
  });
});

describe("owning mods", () => {
  it("sells for half price from the bank or the grid", () => {
    const run = stocked(["corona", "overclock", null, null, null]);
    buy(run, 0);
    buy(run, 1, { grid: { x: 1, y: 1, rotation: 0 } });
    const money = run.money;
    expect(sell(run, { bank: 0 })).toBeNull();
    expect(sell(run, { piece: 2 })).toBeNull();
    expect(run.money).toBe(money + sellValue("corona") + sellValue("overclock"));
    expect(run.bank[0]).toBeNull();
    expect(run.grid).toEqual([]);
    expect(sell(run, { bank: 0 })).toBe("missing");
    expect(sell(run, { piece: 2 })).toBe("missing");
  });

  it("moves between bank and grid carrying its rotation, and refuses an illegal drop without losing the piece", () => {
    const run = stocked(["thunderclap", "static", null, null, null]);
    buy(run, 0);
    buy(run, 1);
    expect(move(run, { bank: 0 }, { grid: { x: 0, y: 1, rotation: 0 } })).toBeNull();
    expect(run.grid).toEqual([{ uid: 1, mod: "thunderclap", rotation: 0, x: 0, y: 1 }]);
    const before = structuredClone(run);
    expect(move(run, { bank: 1 }, { grid: { x: 0, y: 1, rotation: 0 } })).toBe("blocked");
    expect(run).toEqual(before);
    expect(move(run, { bank: 1 }, { grid: { x: 0, y: 0, rotation: 0 } })).toBeNull();
    expect(move(run, { piece: 1 }, { bank: 3 })).toBeNull();
    expect(run.bank[3]).toEqual({ uid: 1, mod: "thunderclap", rotation: 0 });
    // Within the grid, over its own old cells.
    expect(move(run, { piece: 2 }, { grid: { x: 0, y: 0, rotation: 1 } })).toBeNull();
    expect(run.grid).toEqual([{ uid: 2, mod: "static", rotation: 1, x: 0, y: 0 }]);
    expect(move(run, { bank: 3 }, { bank: 3 })).toBeNull();
  });

  it("rotates a banked mod freely and a placed one only where the turn is legal", () => {
    const run = stocked(["static", "ember", null, null, null]);
    buy(run, 0);
    expect(rotate(run, { bank: 0 })).toBeNull();
    expect(run.bank[0]!.rotation).toBe(1);
    expect(move(run, { bank: 0 }, { grid: { x: 1, y: 0, rotation: 1 } })).toBeNull();
    // Standing in the middle column, turning flat from (1,0) would run off the board.
    expect(rotate(run, { piece: 1 })).toBe("blocked");
    expect(run.grid[0]).toMatchObject({ rotation: 1, x: 1, y: 0 });
    expect(move(run, { piece: 1 }, { grid: { x: 0, y: 0, rotation: 0 } })).toBeNull();
    expect(buy(run, 1, { grid: { x: 0, y: 1, rotation: 0 } })).toBeNull();
    // Flat along the top, turning upright into (0,1) would land on the Ember.
    expect(rotate(run, { piece: 1 })).toBe("blocked");
    expect(run.grid.find((piece) => piece.uid === 1)).toMatchObject({ rotation: 0, x: 0, y: 0 });
    expect(sell(run, { piece: 2 })).toBeNull();
    expect(rotate(run, { piece: 1 })).toBeNull();
    expect(run.grid[0]).toMatchObject({ rotation: 1, x: 0, y: 0 });
  });
});

describe("the shop", () => {
  it("rerolls for a dollar into the day's next roll, and unlocks", () => {
    const run = newRun(SEED);
    toggleLock(run);
    expect(run.shop.locked).toBe(true);
    expect(reroll(run)).toBeNull();
    expect(run.money).toBe(STARTING_MONEY - REROLL_PRICE);
    expect(run.shop).toEqual({ offers: rollOffers(SEED, 1, 1), locked: false, rerolls: 1 });
    run.money = 0;
    expect(reroll(run)).toBe("cannot-afford");
  });

  it("rerolls free once a day for each Coupon on the grid", () => {
    const run = stocked(["coupon", null, null, null, null], 4);
    buy(run, 0, { grid: { x: 0, y: 0, rotation: 0 } });
    expect(run.money).toBe(0);
    expect(rerollPrice(run)).toBe(0);
    expect(reroll(run)).toBeNull();
    expect(rerollPrice(run)).toBe(REROLL_PRICE);
    expect(reroll(run)).toBe("cannot-afford");
  });

  it("keeps locked offers that were not bought into tomorrow and refills the sold ones", () => {
    const run = stocked(["ember", "static", "coil", "shade", "spark"]);
    buy(run, 1);
    toggleLock(run);
    playDay(run, WIN);
    expect(nextDay(run)).toBeNull();
    const fresh = rollOffers(SEED, 2, 0);
    expect(run.shop).toEqual({ offers: ["ember", fresh[1], "coil", "shade", "spark"], locked: false, rerolls: 0 });

    const unlocked = stocked(["ember", "static", "coil", "shade", "spark"]);
    playDay(unlocked, WIN);
    nextDay(unlocked);
    expect(unlocked.shop.offers).toEqual(fresh);
  });
});

describe("the day", () => {
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
    const run = stocked(["ember", "ember", null, null, null]);
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
    expect(run.last).toMatchObject({ day: 1, result: "victory", earned: 5 + 2 + 2 + 2 });
    expect(run.money).toBe(12 + 11);
    expect(run.record).toEqual({ wins: 1, losses: 0, draws: 0, bestStyle: 2 });
    expect(run.stake).toBeNull();
  });

  it("takes a heart for a defeat and nothing for a draw", () => {
    const run = newRun(SEED);
    playDay(run, LOSS);
    expect([run.hearts, run.trophies, run.money]).toEqual([RUN_HEARTS - 1, 0, STARTING_MONEY + 5 + 0 + 2]);
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
