/** How rare a mod is. Rarity is fixed by the mod; stars are its upgrade level. */

export const RARITIES = ["common", "uncommon", "rare", "super-rare", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityInfo {
  readonly label: string;
  /** What one copy costs in the shop. */
  readonly price: number;
}

export const RARITY: Readonly<Record<Rarity, RarityInfo>> = {
  "common": { label: "Common", price: 3 },
  "uncommon": { label: "Uncommon", price: 4 },
  "rare": { label: "Rare", price: 5 },
  "super-rare": { label: "Super Rare", price: 7 },
  "legendary": { label: "Legendary", price: 8 },
};

export function isRarity(value: unknown): value is Rarity {
  return typeof value === "string" && (RARITIES as readonly string[]).includes(value);
}
