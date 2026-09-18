import { describe, expect, it } from "vitest";

import { CATALOG } from "../../src/mods/catalog.ts";
import { BASE_INCOME, INTEREST_CAP, RESULT_INCOME, STYLE_INCOME, interest, payday, sellValue, total } from "../../src/run/economy.ts";
import { MOD_IDS } from "../../src/mods/catalog.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { place } from "../../src/mods/grid.ts";
import { SHOP_SIZE, TIER_ODDS, rollOffers, shopRank } from "../../src/run/shop.ts";
import type { ShopRank } from "../../src/run/shop.ts";

describe("the shop", () => {
  it("shows five of the sixteen mods at a time", () => {
    expect(SHOP_SIZE).toBe(5);
    expect(rollOffers(1, 1, 0)).toHaveLength(5);
  });

  it("ranks up with the day", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map(shopRank)).toEqual([1, 1, 2, 2, 3, 3, 3, 4, 4]);
    for (const rank of [1, 2, 3, 4] as ShopRank[]) expect(TIER_ODDS[rank].reduce((sum, odds) => sum + odds, 0)).toBe(100);
  });

  it("rolls the same offers for the same seed, day and reroll, and different ones otherwise", () => {
    expect(rollOffers(77, 3, 2)).toEqual(rollOffers(77, 3, 2));
    const rolls = new Set([rollOffers(77, 3, 0), rollOffers(77, 3, 1), rollOffers(77, 4, 0), rollOffers(78, 3, 0)].map((offers) => offers.join()));
    expect(rolls.size).toBe(4);
  });

  it("only offers tiers the day's odds allow, in about the proportions it says", () => {
    for (const [day, rank] of [[1, 1], [3, 2], [5, 3], [9, 4]] as const) {
      const counts = [0, 0, 0, 0];
      let offers = 0;
      for (let seed = 0; seed < 600; seed++) {
        for (const mod of rollOffers(seed, day, 0)) {
          counts[CATALOG[mod].tier - 1]++;
          offers++;
        }
      }
      TIER_ODDS[rank].forEach((odds, tier) => {
        if (odds === 0) expect(counts[tier], `rank ${rank} tier ${tier + 1}`).toBe(0);
        else expect(Math.abs(counts[tier] / offers - odds / 100), `rank ${rank} tier ${tier + 1}`).toBeLessThan(0.03);
      });
    }
  });
});

describe("the economy", () => {
  it("buys back at half price, rounded down, never less than a dollar", () => {
    for (const mod of MOD_IDS) expect(sellValue(mod)).toBe(Math.max(1, Math.floor(CATALOG[mod].price / 2)));
    expect(sellValue("ember")).toBe(1);
    expect(sellValue("overclock")).toBe(4);
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

    const perks = compileBuild(place(place([], { uid: 1, mod: "crowd-pleaser", rotation: 0, x: 0, y: 0 })!, { uid: 2, mod: "piggy-bank", rotation: 0, x: 0, y: 1 })!);
    const doubled = payday({ result: "victory", stake: 0, peakStyle: 2, build: perks });
    expect(doubled.find((line) => line.label === "style")!.amount).toBe(2 * STYLE_INCOME[2]);
    expect(doubled.find((line) => line.label === "perks")!.amount).toBe(1);
  });
});
