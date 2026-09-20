import type { ActionType } from "../battle/actions.ts";
import type { Rarity } from "./rarity.ts";
import { DEFINITIONS } from "./registry.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import { SHAPES } from "./shapes.ts";
import type { ModType } from "./tags.ts";

export type CatalogAffinity = ActionType | "none";
export type SizeClass = 1 | 2 | 3 | 4;

export interface CatalogFilter {
  readonly types: ReadonlySet<ModType>;
  readonly affinities: ReadonlySet<CatalogAffinity>;
  readonly sizes: ReadonlySet<SizeClass>;
  readonly rarities: ReadonlySet<Rarity>;
}

const emptySet = <T>(): ReadonlySet<T> => new Set<T>();

/** Every empty group passes everything. */
export const NO_FILTER: CatalogFilter = Object.freeze({
  types: emptySet<ModType>(),
  affinities: emptySet<CatalogAffinity>(),
  sizes: emptySet<SizeClass>(),
  rarities: emptySet<Rarity>(),
});

type FilterGroup = keyof CatalogFilter;
type SetValue<T> = T extends ReadonlySet<infer V> ? V : never;

/** Toggle one choice without mutating the incoming filter. */
export function toggle<G extends FilterGroup>(
  filter: CatalogFilter,
  group: G,
  value: SetValue<CatalogFilter[G]>,
): CatalogFilter {
  const next = new Set(filter[group] as ReadonlySet<SetValue<CatalogFilter[G]>>);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return Object.freeze({ ...filter, [group]: next }) as CatalogFilter;
}

function passes<T>(selected: ReadonlySet<T>, value: T): boolean {
  return selected.size === 0 || selected.has(value);
}

export function matches(definition: ModDefinition, filter: CatalogFilter): boolean {
  const affinity: CatalogAffinity = definition.affinity ?? "none";
  const size = SHAPES[definition.shape].cells.length as SizeClass;
  return passes(filter.types, definition.type)
    && passes(filter.affinities, affinity)
    && passes(filter.sizes, size)
    && passes(filter.rarities, definition.rarity);
}

/** The catalogue under a filter, in registry order. */
export function armoryList(
  filter: CatalogFilter,
  definitions: readonly ModDefinition[] = DEFINITIONS,
): ModDefinition[] {
  return definitions.filter((definition) => matches(definition, filter));
}

export function filterSummary(filter: CatalogFilter): string {
  const count = filter.types.size + filter.affinities.size + filter.sizes.size + filter.rarities.size;
  return count === 0 ? "NONE" : String(count);
}

/** How many copies of a mod the player owns; the Armory never knows where that number lives. */
export type Owned = (mod: ModId) => number;

/** How much of the catalogue the player owns at least one copy of. */
export function collected(
  owned: Owned,
  definitions: readonly ModDefinition[] = DEFINITIONS,
): { readonly owned: number; readonly total: number } {
  return {
    owned: definitions.filter((definition) => owned(definition.id as ModId) > 0).length,
    total: definitions.length,
  };
}
