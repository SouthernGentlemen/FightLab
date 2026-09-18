import type { ActionType } from "../battle/actions.ts";
import { RARITY, MATERIAL_LABEL } from "./rarity.ts";
import type { Rarity } from "./rarity.ts";
import { DEFINITIONS } from "./registry.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import { tagLine } from "./tags.ts";
import type { Element } from "./tags.ts";

/**
 * The Armory's catalogue: the registry itself, filtered. It lists the very records combat runs on,
 * so nothing the Armory shows can differ from what a fight does.
 */

export interface ArmoryFilter {
  readonly element: Element | "all";
  readonly action: ActionType | "all";
  readonly rarity: Rarity | "all";
  readonly ownedOnly: boolean;
  /** Matched, ignoring case, against the name, the description, the type and the rarity. */
  readonly text: string;
}

export const EVERYTHING: ArmoryFilter = Object.freeze({ element: "all", action: "all", rarity: "all", ownedOnly: false, text: "" });

/** How many copies of a mod the player owns; the Armory never knows where that number lives. */
export type Owned = (mod: ModId) => number;

function searchable(definition: ModDefinition): string {
  const { label, material } = RARITY[definition.rarity];
  return `${definition.name} ${definition.description} ${tagLine(definition.tags)} ${label} ${MATERIAL_LABEL[material]}`.toLowerCase();
}

export function matches(definition: ModDefinition, filter: ArmoryFilter, owned: Owned): boolean {
  const text = filter.text.trim().toLowerCase();
  return (filter.element === "all" || definition.tags.includes(filter.element))
    && (filter.action === "all" || definition.tags.includes(filter.action))
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
