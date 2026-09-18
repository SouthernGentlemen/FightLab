import { CATALOG, MOD_IDS, TIERS } from "../mods/catalog.ts";
import type { ModId, Tier } from "../mods/catalog.ts";
import { stream } from "./random.ts";
import type { Random } from "./random.ts";

/** The catalogue is sixteen mods; the shop shows five of them at a time. */
export const SHOP_SIZE = 5;
export const REROLL_PRICE = 1;

export type ShopRank = 1 | 2 | 3 | 4;

/** Percent chance of each tier, T1 to T4, by shop rank. */
export const TIER_ODDS: Readonly<Record<ShopRank, readonly [number, number, number, number]>> = {
  1: [80, 20, 0, 0],
  2: [55, 35, 10, 0],
  3: [30, 40, 25, 5],
  4: [15, 35, 35, 15],
};

export function shopRank(day: number): ShopRank {
  if (day <= 2) return 1;
  if (day <= 4) return 2;
  if (day <= 7) return 3;
  return 4;
}

const BY_TIER: Readonly<Record<Tier, readonly ModId[]>> = {
  1: MOD_IDS.filter((id) => CATALOG[id].tier === 1),
  2: MOD_IDS.filter((id) => CATALOG[id].tier === 2),
  3: MOD_IDS.filter((id) => CATALOG[id].tier === 3),
  4: MOD_IDS.filter((id) => CATALOG[id].tier === 4),
};

/** One offer: a tier by the day's odds, then a mod of that tier, uniformly, with replacement. */
export function drawOffer(random: Random, day: number): ModId {
  const tier = random.weighted(TIERS, TIER_ODDS[shopRank(day)]);
  return random.pick(BY_TIER[tier]);
}

/** The offers for `day` after `reroll` rerolls — a pure function of the three. */
export function rollOffers(seed: number, day: number, reroll: number): ModId[] {
  const random = stream(seed, "shop", day, reroll);
  return Array.from({ length: SHOP_SIZE }, () => drawOffer(random, day));
}
