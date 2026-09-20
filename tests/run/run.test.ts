import { describe, expect, it } from "vitest";

import { defaultLoadout } from "../../src/battle/bars.ts";
import { DEFINITIONS, priceOf } from "../../src/mods/registry.ts";
import type { ModId } from "../../src/mods/registry.ts";
import { pick } from "../mods/fixtures.ts";
import { STARTING_MONEY, sellValue } from "../../src/run/economy.ts";
import {
  beginFight, buy, finishFight, move, newRun, nextDay, opponentOf, reroll, rerollPrice, rotate, sell, toggleLock,
} from "../../src/run/run.ts";
import type { FightReport, RunState } from "../../src/run/run.ts";
import { opponentFor } from "../../src/run/opponents.ts";
import { REROLL_PRICE, rollOffers } from "../../src/run/shop.ts";

const SEED = 20260918;
const SINGLE = pick({ size: 1 });
const STRAIGHT_TRIOMINO = DEFINITIONS.find(({ shape }) => shape === "triomino-i")!;
const DOMINO = pick({ size: 2 });
const LEGENDARY = pick({ rarity: "legendary", size: 4 });
const ARC_SINGLE = pick({ type: "arc", size: 1 });
const VOID_SINGLE = pick({ type: "void", size: 1 });
const COUPON = pick({ type: "neutral", affinity: null, rarity: "uncommon", size: 1 });
const FIVE = [SINGLE, STRAIGHT_TRIOMINO, DOMINO, ARC_SINGLE, VOID_SINGLE] as const;

function stocked(offers: ReadonlyArray<ModId | null>, money = 50): RunState {
  const run = newRun(SEED);
  run.shop = { ...run.shop, offers: Object.freeze([...offers]) };
  run.money = money;
  return run;
}

const WIN: FightReport = { result: "victory", reason: "ko", peakStyle: 2, rounds: 3 };
function playDay(run: RunState): void {
  expect(beginFight(run)).toBeNull();
  expect(finishFight(run, WIN)).toBeNull();
}

describe("a new run", () => {
  it("starts on day 1 in prep with the default bars and an empty build", () => {
    const run = newRun(SEED);
    expect(run).toMatchObject({
      seed: SEED, day: 1, phase: "prep", hearts: 5, trophies: 0, money: STARTING_MONEY,
      grid: [], bank: [null, null, null, null], stake: null, last: null, ending: null,
      record: { wins: 0, losses: 0, draws: 0, bestStyle: 0 },
    });
    expect(run.loadout).toEqual(defaultLoadout());
    expect(run.shop).toEqual({ offers: rollOffers(SEED, 1, 0), locked: false, rerolls: 0 });
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
    const run = stocked([SINGLE.id, STRAIGHT_TRIOMINO.id, null, LEGENDARY.id, DOMINO.id]);
    expect(buy(run, 1)).toBeNull();
    expect(run.bank[0]).toEqual({ uid: 1, mod: STRAIGHT_TRIOMINO.id, stars: 1, rotation: 0 });
    expect(run.money).toBe(50 - priceOf(STRAIGHT_TRIOMINO.id));
    expect(run.shop.offers).toEqual([SINGLE.id, null, null, LEGENDARY.id, DOMINO.id]);
    expect(buy(run, 0)).toBeNull();
    expect(run.bank[1]).toEqual({ uid: 2, mod: SINGLE.id, stars: 1, rotation: 0 });
    expect(run.nextUid).toBe(3);
  });

  it("drops a mod straight onto the grid when the placement is legal", () => {
    const run = stocked([STRAIGHT_TRIOMINO.id, SINGLE.id, null, null, null]);
    expect(buy(run, 0, { grid: { x: 0, y: 0, rotation: 90 } })).toBeNull();
    expect(run.grid).toEqual([{ uid: 1, mod: STRAIGHT_TRIOMINO.id, stars: 1, rotation: 90, x: 0, y: 0 }]);
    expect(buy(run, 1, { grid: { x: 0, y: 1, rotation: 0 } })).toBe("blocked");
    expect(run.shop.offers[1]).toBe(SINGLE.id);
  });

  it("refuses what it cannot afford, what is sold out, and what has nowhere to go", () => {
    const poor = stocked([LEGENDARY.id, null, SINGLE.id, SINGLE.id, SINGLE.id], 6);
    expect(buy(poor, 0)).toBe("cannot-afford");
    expect(buy(poor, 1)).toBe("sold-out");
    const full = stocked(FIVE.map(({ id }) => id));
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
    const run = stocked([LEGENDARY.id, SINGLE.id, null, null, null]);
    buy(run, 0);
    buy(run, 1, { grid: { x: 1, y: 1, rotation: 0 } });
    const money = run.money;
    expect(sell(run, { bank: 0 })).toBeNull();
    expect(sell(run, { piece: 2 })).toBeNull();
    expect(run.money).toBe(money + sellValue({ mod: LEGENDARY.id, stars: 1 }) + sellValue({ mod: SINGLE.id, stars: 1 }));
    expect(run.bank[0]).toBeNull();
    expect(run.grid).toEqual([]);
  });

  it("moves between bank and grid carrying its rotation and refuses an illegal drop", () => {
    const run = stocked([SINGLE.id, STRAIGHT_TRIOMINO.id, null, null, null]);
    buy(run, 0);
    buy(run, 1);
    expect(move(run, { bank: 0 }, { grid: { x: 0, y: 1, rotation: 0 } })).toBeNull();
    expect(run.grid).toEqual([{ uid: 1, mod: SINGLE.id, stars: 1, rotation: 0, x: 0, y: 1 }]);
    const before = structuredClone(run);
    expect(move(run, { bank: 1 }, { grid: { x: 0, y: 1, rotation: 0 } })).toBe("blocked");
    expect(run).toEqual(before);
    expect(move(run, { bank: 1 }, { grid: { x: 0, y: 0, rotation: 0 } })).toBeNull();
    expect(move(run, { piece: 1 }, { bank: 3 })).toBeNull();
    expect(run.bank[3]).toEqual({ uid: 1, mod: SINGLE.id, stars: 1, rotation: 0 });
    expect(move(run, { piece: 2 }, { grid: { x: 0, y: 0, rotation: 90 } })).toBeNull();
    expect(run.grid).toEqual([{ uid: 2, mod: STRAIGHT_TRIOMINO.id, stars: 1, rotation: 90, x: 0, y: 0 }]);
  });

  it("rotates a banked mod freely and a placed one only where the turn is legal", () => {
    const run = stocked([STRAIGHT_TRIOMINO.id, SINGLE.id, null, null, null]);
    buy(run, 0);
    expect(rotate(run, { bank: 0 })).toBeNull();
    expect(run.bank[0]!.rotation).toBe(90);
    expect(move(run, { bank: 0 }, { grid: { x: 1, y: 0, rotation: 90 } })).toBeNull();
    expect(rotate(run, { piece: 1 })).toBe("blocked");
    expect(move(run, { piece: 1 }, { grid: { x: 0, y: 0, rotation: 0 } })).toBeNull();
    expect(buy(run, 1, { grid: { x: 0, y: 1, rotation: 0 } })).toBeNull();
    expect(rotate(run, { piece: 1 })).toBe("blocked");
    expect(sell(run, { piece: 2 })).toBeNull();
    expect(rotate(run, { piece: 1 })).toBeNull();
    expect(run.grid[0]).toMatchObject({ rotation: 90, x: 0, y: 0 });
  });
});

describe("the shop", () => {
  it("rerolls for a dollar into the day's next roll, and unlocks", () => {
    const run = newRun(SEED);
    toggleLock(run);
    expect(reroll(run)).toBeNull();
    expect(run.money).toBe(STARTING_MONEY - REROLL_PRICE);
    expect(run.shop).toEqual({ offers: rollOffers(SEED, 1, 1), locked: false, rerolls: 1 });
    run.money = 0;
    expect(reroll(run)).toBe("cannot-afford");
  });

  it("rerolls free once a day for each reroll perk on the grid", () => {
    const run = stocked([COUPON.id, null, null, null, null], 4);
    buy(run, 0, { grid: { x: 0, y: 0, rotation: 0 } });
    expect(run.money).toBe(0);
    expect(rerollPrice(run)).toBe(0);
    expect(reroll(run)).toBeNull();
    expect(rerollPrice(run)).toBe(REROLL_PRICE);
  });

  it("keeps locked offers that were not bought into tomorrow and refills sold ones", () => {
    const offers = FIVE.map(({ id }) => id);
    const run = stocked(offers);
    buy(run, 1);
    toggleLock(run);
    playDay(run);
    expect(nextDay(run)).toBeNull();
    const fresh = rollOffers(SEED, 2, 0);
    expect(run.shop).toEqual({ offers: [offers[0], fresh[1], ...offers.slice(2)], locked: false, rerolls: 0 });
    const unlocked = stocked(offers);
    playDay(unlocked);
    nextDay(unlocked);
    expect(unlocked.shop.offers).toEqual(fresh);
  });
});
