/**
 * How rare a mod is, and what it is made of. Rarity is fixed by the mod and never changes when it
 * is upgraded; stars are the upgrade level. The two are never drawn with the same device: rarity is
 * the material the stars are cast in, star count is how many there are.
 */

export const RARITIES = ["common", "uncommon", "rare", "super-rare", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const MATERIALS = ["iron", "bronze", "silver", "gold", "diamond"] as const;
export type Material = (typeof MATERIALS)[number];

export interface RarityInfo {
  readonly label: string;
  readonly material: Material;
  /** What one copy costs in the shop. */
  readonly price: number;
}

export const RARITY: Readonly<Record<Rarity, RarityInfo>> = {
  "common": { label: "Common", material: "iron", price: 3 },
  "uncommon": { label: "Uncommon", material: "bronze", price: 4 },
  "rare": { label: "Rare", material: "silver", price: 5 },
  "super-rare": { label: "Super Rare", material: "gold", price: 7 },
  "legendary": { label: "Legendary", material: "diamond", price: 8 },
};

export const MATERIAL_LABEL: Readonly<Record<Material, string>> = {
  iron: "Iron", bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond",
};

export function isRarity(value: unknown): value is Rarity {
  return typeof value === "string" && (RARITIES as readonly string[]).includes(value);
}

/** `RARE · SILVER`. */
export function rarityLine(rarity: Rarity): string {
  return `${RARITY[rarity].label} · ${MATERIAL_LABEL[RARITY[rarity].material]}`.toUpperCase();
}
