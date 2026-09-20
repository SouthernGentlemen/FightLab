import { describe, expect, it } from "vitest";

import { compileBuild } from "../../src/mods/compile.ts";
import { place } from "../../src/mods/grid.ts";
import { RARITIES } from "../../src/mods/rarity.ts";
import { MOD_IDS, REGISTRY, priceOf } from "../../src/mods/registry.ts";
import { pick, placement } from "../mods/fixtures.ts";
import { BASE_INCOME, INTEREST_CAP, RESULT_INCOME, STYLE_INCOME, interest, payday, sellValue, total } from "../../src/run/economy.ts";
import { RARITY_ODDS, SHOP_SIZE, rollOffers, shopRank } from "../../src/run/shop.ts";
import type { ShopRank } from "../../src/run/shop.ts";

const COMMON = pick({ rarity: "common" });
const LEGENDARY = pick({ rarity: "legendary" });
const INCOME_BASE = pick({ type: "solar", size: 1 });
const STYLE_BASE = pick({ type: "arc", size: 1 });

describe("the shop", () => {
  it("shows five of the registry's mods at a time", () => {
    expect(SHOP_SIZE).toBe(5);
    expect(rollOffers(1, 1, 0)).toHaveLength(5);
  });

  it("ranks up with the day", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map(shopRank)).toEqual([1, 1, 2, 2, 3, 3, 3, 4, 4]);
    for (const rank of [1, 2, 3, 4] as ShopRank[]) expect(RARITY_ODDS[rank].reduce((sum, odds) => sum + odds, 0)).toBe(100);
  });

  it("rolls the same offers for the same seed, day and reroll, and different ones otherwise", () => {
    expect(rollOffers(77, 3, 2)).toEqual(rollOffers(77, 3, 2));
    const rolls = new Set([rollOffers(77, 3, 0), rollOffers(77, 3, 1), rollOffers(77, 4, 0), rollOffers(78, 3, 0)].map((offers) => offers.join()));
    expect(rolls.size).toBe(4);
  });

  it("only offers rarities the day's odds allow, in about the proportions it says", () => {
    for (const [day, rank] of [[1, 1], [3, 2], [5, 3], [9, 4]] as const) {
      const counts = [0, 0, 0, 0, 0];
      let offers = 0;
      for (let seed = 0; seed < 600; seed++) {
        for (const mod of rollOffers(seed, day, 0)) {
          counts[RARITIES.indexOf(REGISTRY[mod].rarity)]++;
          offers++;
        }
      }
      RARITY_ODDS[rank].forEach((odds, index) => {
        if (odds === 0) expect(counts[index], `rank ${rank} ${RARITIES[index]}`).toBe(0);
        else expect(Math.abs(counts[index] / offers - odds / 100), `rank ${rank} ${RARITIES[index]}`).toBeLessThan(0.03);
      });
    }
  });
});

describe("the economy", () => {
  it("buys back at half the price of every copy inside, rounded down, never less than a dollar", () => {
    for (const mod of MOD_IDS) expect(sellValue({ mod, stars: 1 })).toBe(Math.max(1, Math.floor(priceOf(mod) / 2)));
    expect(sellValue({ mod: COMMON.id, stars: 1 })).toBe(1);
    expect(sellValue({ mod: COMMON.id, stars: 2 })).toBe(4);
    expect(sellValue({ mod: COMMON.id, stars: 3 })).toBe(9);
    expect(sellValue({ mod: LEGENDARY.id, stars: 1 })).toBe(4);
  });

  it("pays a dollar of interest per five held, up to two", () => {
    expect([0, 4, 5, 9, 10, 14, 15, 60].map(interest)).toEqual([0, 0, 1, 1, 2, 2, 2, 2]);
    expect(INTEREST_CAP).toBe(2);
  });

  it("tallies payday line by line: base, result, interest, style and perks", () => {
    const plain = payday({ result: "victory", stake: 12, peakStyle: 3, build: compileBuild([]) });
    expect(plain).toEqual([
      { label: "base", amount: BASE_INCOME },
      { label: "result", amount: RESULT_INCOME.victory },
      { label: "interest", amount: 2 },
      { label: "style", amount: STYLE_INCOME[3] },
      { label: "perks", amount: 0 },
    ]);
    expect(total(plain)).toBe(5 + 2 + 2 + 3);
    expect(total(payday({ result: "defeat", stake: 0, peakStyle: 0, build: compileBuild([]) }))).toBe(5);
    expect(total(payday({ result: "draw", stake: 5, peakStyle: 1, build: compileBuild([]) }))).toBe(5 + 1 + 1 + 1);

    const income = { ...INCOME_BASE, type: "neutral" as const, affinity: null, effects: [], effect: { kind: "perk" as const, perk: "income" as const, amount: [1, 2, 3] as const } };
    const style = { ...STYLE_BASE, type: "neutral" as const, affinity: null, effects: [], effect: { kind: "perk" as const, perk: "style" as const, amount: [1, 2, 3] as const } };
    const grid = place(
      place([], { uid: 1, stars: 1, ...placement([style, 0, 0]) })!,
      { uid: 2, stars: 1, ...placement([income, 0, 1]) },
    )!;
    const perks = compileBuild(grid, { [income.id]: income, [style.id]: style });
    const doubled = payday({ result: "victory", stake: 0, peakStyle: 2, build: perks });
    expect(doubled.find((line) => line.label === "style")!.amount).toBe(2 * STYLE_INCOME[2]);
    expect(doubled.find((line) => line.label === "perks")!.amount).toBe(1);
  });
});
