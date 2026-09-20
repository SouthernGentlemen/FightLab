import type { ActionType } from "../../src/battle/actions.ts";
import type { Placement } from "../../src/mods/grid.ts";
import { DEFINITIONS } from "../../src/mods/registry.ts";
import type { ModDefinition, ModId } from "../../src/mods/registry.ts";
import { SHAPES } from "../../src/mods/shapes.ts";
import type { Rotation } from "../../src/mods/shapes.ts";
import type { Rarity } from "../../src/mods/rarity.ts";
import type { ModType } from "../../src/mods/types.ts";

export interface PickCriteria {
  readonly type?: ModType;
  readonly affinity?: ActionType | null;
  readonly size?: 1 | 2 | 3 | 4;
  readonly rarity?: Rarity;
}

export type PickedMod = ModDefinition & { readonly id: ModId };

export function registryFixture(definition: ModDefinition | undefined): PickedMod {
  if (definition === undefined) throw new Error("registry fixture was not found");
  return definition as PickedMod;
}

/** First registry record matching stable attributes shared by the old and replacement catalogues. */
export function pick(criteria: PickCriteria = {}): PickedMod {
  const found = DEFINITIONS.find((definition) =>
    (criteria.type === undefined || definition.type === criteria.type)
    && (!Object.hasOwn(criteria, "affinity") || definition.affinity === criteria.affinity)
    && (criteria.size === undefined || SHAPES[definition.shape].cells.length === criteria.size)
    && (criteria.rarity === undefined || definition.rarity === criteria.rarity));
  if (found === undefined) throw new Error(`no registry mod matches ${JSON.stringify(criteria)}`);
  return registryFixture(found);
}

/** Compact placement fixture: [definition, x, y, rotation]. */
export function placement(
  [definition, x, y, rotation = 0]: readonly [ModDefinition, number, number, Rotation?],
): Placement {
  return { mod: definition.id as ModId, x, y, rotation };
}
