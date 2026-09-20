import { isActionType } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { CATALOGUE } from "./catalogue.ts";
import { scaledOf, scaledOfModEffect } from "./effects.ts";
import type { Effect, ModEffect } from "./effects.ts";
import { RARITY, isRarity } from "./rarity.ts";
import type { Rarity } from "./rarity.ts";
import { SHAPES } from "./shapes.ts";
import type { ShapeId } from "./shapes.ts";
import { isModType } from "./tags.ts";
import type { ModType } from "./tags.ts";
import { catalogueProblemsFor } from "./catalogue-validator.ts";

/**
 * The one mod registry. The shop, grid, compile, combat engine and Armory all read these records,
 * so the catalogue shown to the player is exactly the catalogue the run uses.
 */

/** A glyph from the UI's set. Retired with the rest of the bridge in tasks-040. */
export type ModGlyph = Exclude<ModType, "neutral"> | ActionType | "coin" | "ticket" | "star" | "chip";

export interface ModDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rarity: Rarity;
  readonly type: ModType;
  readonly affinity: ActionType | null;
  readonly shape: ShapeId;
  readonly effects: readonly Effect[];
  readonly effect?: ModEffect;
  readonly visual: { readonly glyph: ModGlyph };
}

export type ModId = (typeof CATALOGUE)[number]["id"];
export type RegisteredModDefinition = ModDefinition & { readonly id: ModId };

const BY_ID = Object.fromEntries(
  CATALOGUE.map((definition) => [definition.id, definition]),
) as Record<ModId, RegisteredModDefinition>;

export const REGISTRY: Readonly<Record<ModId, RegisteredModDefinition>> = Object.freeze(BY_ID);

/** Registry order is catalogue order: type, then affinity, then rarity (§6.2). */
export const MOD_IDS: readonly ModId[] = Object.freeze(CATALOGUE.map((definition) => definition.id));

export function isModId(value: unknown): value is ModId {
  return typeof value === "string" && Object.hasOwn(REGISTRY, value);
}

export function priceOf(id: ModId): number {
  return RARITY[REGISTRY[id].rarity].price;
}

/** Everything wrong with one definition; an empty list when it is sound. */
export function definitionProblems(definition: ModDefinition): string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.push(`${definition.id}: ${problem}`);
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) say("id is not kebab-case");
  if (definition.name.trim() === "" || definition.description.trim() === "") say("needs a name and a description");
  if (!isModType(definition.type)) say("unknown type");
  if (definition.affinity !== null && !isActionType(definition.affinity)) say("unknown affinity");
  if (!isRarity(definition.rarity)) say("unknown rarity");
  if (!Object.hasOwn(SHAPES, definition.shape)) return [...problems, `${definition.id}: unknown shape`];
  if (definition.effects.length === 0 && definition.effect === undefined) say("does nothing");
  const triples = [
    ...definition.effects.flatMap(scaledOf),
    ...(definition.effect === undefined ? [] : scaledOfModEffect(definition.effect)),
  ];
  if (triples.some((triple) =>
    triple.length !== 3 || triple.some((value) => !Number.isInteger(value) || value < 0))) {
    say("a number that is not three whole amounts");
  }
  if (!triples.some(([one, two, three]) => one < two && two < three)) say("nothing grows from ★ to ★★ to ★★★");
  if (definition.effects.some((effect) =>
    (effect.kind === "spend" && effect.payoff.length === 0)
    || (effect.kind === "sink" && effect.per.length === 0))) {
    say("pays for nothing");
  }
  return problems;
}

export interface CatalogueOptions {
  /** Validate one 16-mod type slice while the replacement catalogue is being authored. */
  readonly type?: ModType;
}

export function catalogueProblems(
  definitions: readonly ModDefinition[],
  options: CatalogueOptions = {},
): string[] {
  return catalogueProblemsFor(definitions, options);
}

/** Everything wrong with a whole registry: each definition, and ids or names used twice. */
export function registryProblems(definitions: readonly ModDefinition[]): string[] {
  const problems = definitions.flatMap(definitionProblems);
  for (const key of ["id", "name"] as const) {
    const seen = new Set<string>();
    for (const definition of definitions) {
      if (seen.has(definition[key])) problems.push(`${key} '${definition[key]}' is used twice`);
      seen.add(definition[key]);
    }
  }
  return problems;
}

export const DEFINITIONS: readonly RegisteredModDefinition[] = Object.freeze(
  MOD_IDS.map((id) => REGISTRY[id]),
);
