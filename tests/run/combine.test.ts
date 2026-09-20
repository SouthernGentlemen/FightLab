import { describe, expect, it } from "vitest";

import { REGISTRY, priceOf } from "../../src/mods/registry.ts";
import type { ModId } from "../../src/mods/registry.ts";
import { pick } from "../mods/fixtures.ts";
import { sellValue } from "../../src/run/economy.ts";
import { buy, combineCopies, newRun, sell } from "../../src/run/run.ts";
import type { RunState } from "../../src/run/run.ts";

const FIRST = pick({ size: 1 });
const SECOND = pick({ type: "void", size: 1 });
const RARE = pick({ rarity: "rare", size: 2 });
const ARC_SINGLE = pick({ type: "arc", size: 1 });
const DOMINO = pick({ type: "solar", affinity: "strike", size: 2 });

/** A run whose shop holds exactly these offers, and money enough for all of them. */
function stocked(offers: ReadonlyArray<ModId | null>, money = 80): RunState {
  const run = newRun(20260918);
  run.shop = { ...run.shop, offers: Object.freeze([...offers]) };
  run.money = money;
  return run;
}

/** Buys every offer of a freshly stocked shop, in order, into the given destinations. */
function buyAll(run: RunState, destinations: ReadonlyArray<Parameters<typeof buy>[2]>): void {
  destinations.forEach((to, offer) => expect(buy(run, offer, to), `offer ${offer}`).toBeNull());
}

describe("combining copies", () => {
  it("makes one ★★ from three ★ copies, where the oldest copy stood and turned the way it was", () => {
    const run = stocked([FIRST.id, FIRST.id, FIRST.id, null, null]);
    buyAll(run, [{ grid: { x: 1, y: 1, rotation: 180 } }, undefined, { grid: { x: 0, y: 0, rotation: 0 } }]);
    expect(run.grid).toEqual([{ uid: 1, mod: FIRST.id, stars: 2, rotation: 0, x: 1, y: 1 }]);
    expect(run.bank).toEqual([null, null, null, null]);
    expect(run.money).toBe(80 - 3 * priceOf(FIRST.id));
  });

  it("makes one ★★★ from six ★ copies: two ★★ combine as soon as the second is made", () => {
    const run = stocked([SECOND.id, SECOND.id, SECOND.id, SECOND.id, SECOND.id]);
    buyAll(run, [undefined, undefined, undefined, undefined, undefined]);
    expect(run.bank.filter((slot) => slot !== null)).toEqual([
      { uid: 1, mod: SECOND.id, stars: 2, rotation: 0 },
      { uid: 4, mod: SECOND.id, stars: 1, rotation: 0 },
      { uid: 5, mod: SECOND.id, stars: 1, rotation: 0 },
    ]);
    run.shop = { ...run.shop, offers: Object.freeze([SECOND.id, null, null, null, null]) };
    expect(buy(run, 0)).toBeNull();
    expect(run.bank.filter((slot) => slot !== null)).toEqual([{ uid: 1, mod: SECOND.id, stars: 3, rotation: 0 }]);
  });

  it("keeps the mod's rarity, and sells a combined mod for half of every copy inside it", () => {
    const run = stocked([RARE.id, RARE.id, RARE.id, null, null]);
    buyAll(run, [undefined, undefined, undefined]);
    const made = run.bank.find((slot) => slot !== null)!;
    expect(REGISTRY[made.mod].rarity).toBe("rare");
    expect(sellValue(made)).toBe(Math.floor((3 * priceOf(RARE.id)) / 2));
    const money = run.money;
    expect(sell(run, { bank: run.bank.indexOf(made) })).toBeNull();
    expect(run.money).toBe(money + Math.floor((3 * priceOf(RARE.id)) / 2));
  });

  it("lets a copy that completes a set in with the bank full: it needs no slot of its own", () => {
    const run = stocked([ARC_SINGLE.id, ARC_SINGLE.id, DOMINO.id, RARE.id, ARC_SINGLE.id]);
    buyAll(run, [undefined, undefined, undefined, undefined]);
    expect(run.bank.every((slot) => slot !== null)).toBe(true);
    expect(buy(run, 4)).toBeNull();
    expect(run.bank).toEqual([
      { uid: 1, mod: ARC_SINGLE.id, stars: 2, rotation: 0 },
      null,
      { uid: 3, mod: DOMINO.id, stars: 1, rotation: 0 },
      { uid: 4, mod: RARE.id, stars: 1, rotation: 0 },
    ]);
  });

  it("never combines different mods, or copies of different levels", () => {
    const run = stocked([FIRST.id, FIRST.id, SECOND.id, null, null]);
    buyAll(run, [undefined, undefined, undefined]);
    expect(combineCopies(run)).toEqual([]);
    expect(run.bank.filter((slot) => slot !== null).map((slot) => [slot!.mod, slot!.stars]))
      .toEqual([[FIRST.id, 1], [FIRST.id, 1], [SECOND.id, 1]]);
    run.bank = Object.freeze([
      { uid: 1, mod: FIRST.id, stars: 2, rotation: 0 },
      { uid: 2, mod: FIRST.id, stars: 1, rotation: 0 },
      null,
      null,
    ]);
    expect(combineCopies(run)).toEqual([]);
  });

  it("combines the same way every time: the same purchases, the same run", () => {
    const play = () => {
      const run = stocked([DOMINO.id, DOMINO.id, DOMINO.id, DOMINO.id, null]);
      buyAll(run, [{ grid: { x: 0, y: 2, rotation: 0 } }, undefined, { grid: { x: 0, y: 0, rotation: 0 } }, undefined]);
      return run;
    };
    expect(play()).toEqual(play());
    expect(play().grid).toEqual([{ uid: 1, mod: DOMINO.id, stars: 2, rotation: 0, x: 0, y: 2 }]);
  });
});
