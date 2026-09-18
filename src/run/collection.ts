import { MOD_IDS } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { stream } from "./random.ts";

/**
 * Which mods the player has collected, across runs. Nothing persists ownership yet, so the Armory
 * reads it through this one interface and the game hands it a seeded development collection; a
 * saved collection replaces the implementation and nothing that reads it changes.
 */
export interface CollectionRepository {
  /** How many ★ copies of `mod` the player owns. */
  ownedCopies(mod: ModId): number;
}

export const DEV_COLLECTION_SEED = 0x0a4e0;

/** The most copies the development collection hands out: enough to show every star level. */
export const DEV_MAX_COPIES = 7;

/** A deterministic development collection: every mod gets 0 to 7 copies, drawn from the seed. */
export function seededCollection(seed: number = DEV_COLLECTION_SEED): CollectionRepository {
  const copies = new Map(MOD_IDS.map((id) => [id, stream(seed, "collection", id).int(DEV_MAX_COPIES + 1)]));
  return { ownedCopies: (mod) => copies.get(mod) ?? 0 };
}
