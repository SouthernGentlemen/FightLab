import type { ActionType } from "../battle/actions.ts";
import { RARITY } from "./rarity.ts";
import type { Rarity } from "./rarity.ts";
import { DEFINITIONS } from "./registry.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import { AFFINITY_LABEL, TYPE_LABEL } from "./tags.ts";
import type { ModType } from "./tags.ts";

/**
 * The Armory's catalogue: the registry itself, filtered. It lists the very records combat runs on,
 * so nothing the Armory shows can differ from what a fight does.
 */

export interface ArmoryFilter {
  readonly type: ModType | "all";
  readonly affinity: ActionType | "all";
  readonly rarity: Rarity | "all";
  readonly ownedOnly: boolean;
  /** Matched, ignoring case, against the name, the description, the type and the rarity. */
  readonly text: string;
}

export const EVERYTHING: ArmoryFilter = Object.freeze({ type: "all", affinity: "all", rarity: "all", ownedOnly: false, text: "" });

/** How many copies of a mod the player owns; the Armory never knows where that number lives. */
export type Owned = (mod: ModId) => number;

function searchable(definition: ModDefinition): string {
  const { label } = RARITY[definition.rarity];
  const affinity = definition.affinity === null ? "" : ` / ${AFFINITY_LABEL[definition.affinity]}`;
  return `${definition.name} ${definition.description} ${TYPE_LABEL[definition.type]}${affinity} ${label}`.toLowerCase();
}

export function matches(definition: ModDefinition, filter: ArmoryFilter, owned: Owned): boolean {
  const text = filter.text.trim().toLowerCase();
  return (filter.type === "all" || definition.type === filter.type)
    && (filter.affinity === "all" || definition.affinity === filter.affinity)
    && (filter.rarity === "all" || definition.rarity === filter.rarity)
    && (!filter.ownedOnly || owned(definition.id as ModId) > 0)
    && (text === "" || searchable(definition).includes(text));
}

/** The catalogue under a filter, in registry order. */
export function armoryList(filter: ArmoryFilter, owned: Owned, definitions: readonly ModDefinition[] = DEFINITIONS): ModDefinition[] {
  return definitions.filter((definition) => matches(definition, filter, owned));
}

/** How much of the catalogue the player owns at least one copy of. */
export function collected(owned: Owned, definitions: readonly ModDefinition[] = DEFINITIONS): { readonly owned: number; readonly total: number } {
  return { owned: definitions.filter((definition) => owned(definition.id as ModId) > 0).length, total: definitions.length };
}
