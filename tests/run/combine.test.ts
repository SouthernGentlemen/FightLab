import { describe, expect, it } from "vitest";

import { REGISTRY, priceOf } from "../../src/mods/registry.ts";
import type { ModId } from "../../src/mods/registry.ts";
import { sellValue } from "../../src/run/economy.ts";
import { buy, combineCopies, newRun, sell } from "../../src/run/run.ts";
import type { RunState } from "../../src/run/run.ts";

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
    const run = stocked(["heat-coil", "heat-coil", "heat-coil", null, null]);
    buyAll(run, [{ grid: { x: 1, y: 1, rotation: 2 } }, undefined, { grid: { x: 0, y: 0, rotation: 0 } }]);
    expect(run.grid).toEqual([{ uid: 1, mod: "heat-coil", stars: 2, rotation: 2, x: 1, y: 1 }]);
    expect(run.bank).toEqual([null, null, null, null]);
    expect(run.money).toBe(80 - 3 * priceOf("heat-coil"));
  });

  it("makes one ★★★ from six ★ copies: two ★★ combine as soon as the second is made", () => {
    const run = stocked(["void-tap", "void-tap", "void-tap", "void-tap", "void-tap"]);
    buyAll(run, [undefined, undefined, undefined, undefined, undefined]);
    expect(run.bank.filter((slot) => slot !== null)).toEqual([
      { uid: 1, mod: "void-tap", stars: 2, rotation: 0 },
      { uid: 4, mod: "void-tap", stars: 1, rotation: 0 },
      { uid: 5, mod: "void-tap", stars: 1, rotation: 0 },
    ]);
    run.shop = { ...run.shop, offers: Object.freeze(["void-tap", null, null, null, null]) };
    expect(buy(run, 0)).toBeNull();
    expect(run.bank.filter((slot) => slot !== null)).toEqual([{ uid: 1, mod: "void-tap", stars: 3, rotation: 0 }]);
  });

  it("keeps the mod's rarity, and sells a combined mod for half of every copy inside it", () => {
    const run = stocked(["furnace", "furnace", "furnace", null, null]);
    buyAll(run, [undefined, undefined, undefined]);
    const made = run.bank.find((slot) => slot !== null)!;
    expect(REGISTRY[made.mod].rarity).toBe("rare");
    expect(sellValue(made)).toBe(Math.floor((3 * priceOf("furnace")) / 2));
    const money = run.money;
    expect(sell(run, { bank: run.bank.indexOf(made) })).toBeNull();
    expect(run.money).toBe(money + Math.floor((3 * priceOf("furnace")) / 2));
  });

  it("lets a copy that completes a set in with the bank full: it needs no slot of its own", () => {
    const run = stocked(["arc-dynamo", "arc-dynamo", "live-wire", "furnace", "arc-dynamo"]);
    buyAll(run, [undefined, undefined, undefined, undefined]);
    expect(run.bank.every((slot) => slot !== null)).toBe(true);
    expect(buy(run, 4)).toBeNull();
    expect(run.bank).toEqual([
      { uid: 1, mod: "arc-dynamo", stars: 2, rotation: 0 },
      null,
      { uid: 3, mod: "live-wire", stars: 1, rotation: 0 },
      { uid: 4, mod: "furnace", stars: 1, rotation: 0 },
    ]);
  });

  it("never combines different mods, or copies of different levels", () => {
    const run = stocked(["heat-coil", "heat-coil", "void-tap", null, null]);
    buyAll(run, [undefined, undefined, undefined]);
    expect(combineCopies(run)).toEqual([]);
    expect(run.bank.filter((slot) => slot !== null).map((slot) => [slot!.mod, slot!.stars])).toEqual([["heat-coil", 1], ["heat-coil", 1], ["void-tap", 1]]);
    run.bank = Object.freeze([{ uid: 1, mod: "heat-coil", stars: 2, rotation: 0 }, { uid: 2, mod: "heat-coil", stars: 1, rotation: 0 }, null, null]);
    expect(combineCopies(run)).toEqual([]);
  });

  it("combines the same way every time: the same purchases, the same run", () => {
    const play = () => {
      const run = stocked(["cinder-edge", "cinder-edge", "cinder-edge", "cinder-edge", null]);
      buyAll(run, [{ grid: { x: 0, y: 2, rotation: 0 } }, undefined, { grid: { x: 0, y: 0, rotation: 0 } }, undefined]);
      return run;
    };
    expect(play()).toEqual(play());
    expect(play().grid).toEqual([{ uid: 1, mod: "cinder-edge", stars: 2, rotation: 0, x: 0, y: 2 }]);
  });
});
