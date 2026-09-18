import { RARITIES } from "../mods/rarity.ts";
import type { Rarity } from "../mods/rarity.ts";
import { MOD_IDS, REGISTRY } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { stream } from "./random.ts";
import type { Random } from "./random.ts";

/** The shop shows five of the registry's mods at a time. */
export const SHOP_SIZE = 5;
export const REROLL_PRICE = 1;

export type ShopRank = 1 | 2 | 3 | 4;

/** Percent chance of each rarity, Common to Legendary, by shop rank. */
export const RARITY_ODDS: Readonly<Record<ShopRank, readonly [number, number, number, number, number]>> = {
  1: [70, 30, 0, 0, 0],
  2: [45, 35, 20, 0, 0],
  3: [25, 35, 25, 12, 3],
  4: [10, 25, 30, 25, 10],
};

export function shopRank(day: number): ShopRank {
  if (day <= 2) return 1;
  if (day <= 4) return 2;
  if (day <= 7) return 3;
  return 4;
}

const BY_RARITY = Object.fromEntries(RARITIES.map((rarity) => [rarity, MOD_IDS.filter((id) => REGISTRY[id].rarity === rarity)])) as unknown as Record<Rarity, readonly ModId[]>;

/** One offer: a rarity by the day's odds, then a mod of that rarity, uniformly, with replacement. */
export function drawOffer(random: Random, day: number): ModId {
  const rarity = random.weighted(RARITIES, RARITY_ODDS[shopRank(day)]);
  return random.pick(BY_RARITY[rarity]);
}

/** The offers for `day` after `reroll` rerolls — a pure function of the three. */
export function rollOffers(seed: number, day: number, reroll: number): ModId[] {
  const random = stream(seed, "shop", day, reroll);
  return Array.from({ length: SHOP_SIZE }, () => drawOffer(random, day));
}
