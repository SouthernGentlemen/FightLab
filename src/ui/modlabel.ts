import { RARITY } from "../mods/rarity.ts";
import type { ModDefinition } from "../mods/registry.ts";
import { SHAPE_LABEL } from "../mods/shapes.ts";
import type { Stars } from "../mods/stars.ts";
import { AFFINITY_LABEL, TYPE_LABEL } from "../mods/types.ts";

/** One accessible description for every place the UI presents a mod. */
export function modLabel(definition: ModDefinition, stars?: Stars): string {
  const affinity = definition.affinity === null ? "no affinity" : `${AFFINITY_LABEL[definition.affinity]} affinity`;
  const parts = [
    definition.name,
    TYPE_LABEL[definition.type],
    affinity,
    SHAPE_LABEL[definition.shape],
    RARITY[definition.rarity].label,
  ];
  if (stars !== undefined) parts.push(`${stars} star${stars === 1 ? "" : "s"}`);
  return parts.join(", ");
}
