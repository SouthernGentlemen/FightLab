import { isActionType } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import {
  accrue, burn, capacity, cleanse, convert, damage, generate, heal, leech, perk, poison, refund, scaledOf, scaledOfModEffect, shock, sink, spend,
} from "./effects.ts";
import type { Effect, ModEffect } from "./effects.ts";
import { RARITY, isRarity } from "./rarity.ts";
import type { Rarity } from "./rarity.ts";
import { SHAPES } from "./shapes.ts";
import type { ShapeId } from "./shapes.ts";
import { isModType } from "./tags.ts";
import type { ModType } from "./tags.ts";

/**
 * The one mod registry. The shop, the grid, compile, the combat engine and the Armory all read
 * these records and nothing else, so what the Armory shows is what a fight does. A record is the
 * mod at every star level; stars pick a column of its numbers, never a different record.
 */

/** A glyph from the UI's set. Colour is never the only signal, so every mod names one. */
export type ModGlyph = Exclude<ModType, "neutral"> | ActionType | "coin" | "ticket" | "star" | "chip";

export interface ModDefinition {
  readonly id: string;
  readonly name: string;
  /** Its role in one line. The rules text is written from `effects`, so it cannot drift from them. */
  readonly description: string;
  readonly rarity: Rarity;
  readonly type: ModType;
  readonly affinity: ActionType | null;
  readonly shape: ShapeId;
  readonly effects: readonly Effect[];
  /** New vocabulary bridge; current registry records omit this until tasks-039/040. */
  readonly effect?: ModEffect;
  readonly visual: { readonly glyph: ModGlyph };
}

function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const inner of Object.values(value)) frozen(inner);
    Object.freeze(value);
  }
  return value;
}

function mod<const I extends string>(
  id: I, name: string, rarity: Rarity, type: ModType, affinity: ActionType | null, shape: ShapeId, description: string,
  effects: readonly Effect[], glyph?: ModGlyph, effect?: ModEffect,
): ModDefinition & { readonly id: I } {
  const defaultGlyph = type === "neutral" ? "chip" : type;
  return frozen({
    id, name, description, rarity, type, affinity, shape, effects,
    ...(effect === undefined ? {} : { effect }),
    visual: { glyph: glyph ?? defaultGlyph },
  });
}

const LIST = [
  // Common · Iron
  mod("heat-coil", "Heat Coil", "common", "solar", null, "single", "A basic Heat generator.", [generate("heat", [1, 2, 3])]),
  mod("basic-sink", "Basic Sink", "common", "solar", "block", "single", "Dumps Heat into a guard that heals.",
    [sink("heat", [2, 3, 5], heal([1, 1, 1]))]),
  mod("arc-dynamo", "Arc Dynamo", "common", "arc", null, "single", "A basic Charge producer.", [generate("charge", [1, 2, 3])]),
  mod("battery-cell", "Battery Cell", "common", "arc", null, "single", "Stores more Charge.", [capacity([2, 3, 5])]),
  mod("void-tap", "Void Tap", "common", "void", null, "single", "Drains the opponent's energy into Void.", [leech("either", [1, 2, 3])]),
  // Uncommon · Bronze
  mod("cinder-edge", "Cinder Edge", "uncommon", "solar", "strike", "domino", "Spends Heat on a burning Strike.",
    [spend("heat", [1, 1, 1], damage([2, 3, 4]), burn([2, 3, 5]))]),
  mod("thermal-relay", "Thermal Relay", "uncommon", "solar", "tech", "single", "Makes Heat whenever you Tech.",
    [generate("heat", [2, 3, 5])]),
  mod("live-wire", "Live Wire", "uncommon", "arc", "strike", "domino", "Spends Charge on a shocking Strike.",
    [spend("charge", [1, 1, 1], damage([1, 2, 3]), shock([2, 3, 4]))]),
  mod("capacitor-guard", "Capacitor Guard", "uncommon", "arc", "block", "single", "Spends Charge on a stronger Block.",
    [spend("charge", [2, 2, 2], heal([3, 5, 8]), damage([2, 3, 5]))]),
  mod("venom-tap", "Venom Tap", "uncommon", "void", "strike", "domino", "Spends Void to poison with a Strike.",
    [spend("void", [1, 1, 1], poison([1, 2, 3]))]),
  // Rare · Silver
  mod("furnace", "Furnace", "rare", "solar", null, "domino", "Stronger Heat generation.", [generate("heat", [2, 3, 5])]),
  mod("cooling-array", "Cooling Array", "rare", "solar", "block", "domino", "A larger Heat dump that heals and cools Burn.",
    [sink("heat", [3, 4, 6], heal([1, 1, 1]), cleanse("burn", [1, 1, 2]))]),
  mod("chain-circuit", "Chain Circuit", "rare", "arc", "tech", "triomino-i", "Makes more Charge for every adjacent mod.",
    [generate("charge", [1, 1, 2], [1, 2, 3])]),
  mod("storm-cell", "Storm Cell", "rare", "arc", "strike", "domino", "Spends Charge to set up a heavy Shock.",
    [spend("charge", [2, 2, 2], shock([4, 6, 9]))]),
  mod("null-reservoir", "Null Reservoir", "rare", "void", null, "triomino-l", "Leeches, and deepens your Void every round.",
    [leech("either", [1, 2, 3]), accrue([1, 2, 3])]),
  // Super Rare · Gold
  mod("afterburner", "Afterburner", "super-rare", "solar", "strike", "triomino-l", "Dumps a lot of Heat into a searing Strike.",
    [spend("heat", [3, 3, 3], damage([5, 8, 12]), burn([4, 6, 9]))]),
  mod("phoenix-sink", "Phoenix Sink", "super-rare", "solar", "block", "triomino-l", "A huge Heat dump into a Block that heals and hits back.",
    [sink("heat", [5, 7, 10], heal([1, 1, 1]), damage([1, 1, 1]))]),
  mod("overclock", "Overclock", "super-rare", "arc", "tech", "domino", "Spends a lot of Charge to amplify Tech.",
    [spend("charge", [3, 3, 3], damage([6, 9, 13]))]),
  mod("feedback-loop", "Feedback Loop", "super-rare", "arc", null, "single", "Gives Charge back whenever an adjacent mod spends it.",
    [refund([1, 2, 3])]),
  mod("event-horizon", "Event Horizon", "super-rare", "void", "tech", "triomino-l", "Leeches hard and turns Void into Poison.",
    [leech("either", [2, 3, 4]), spend("void", [2, 2, 2], poison([2, 3, 5]))]),
  // Legendary · Diamond
  mod("solar-flare", "Solar Flare", "legendary", "solar", "strike", "tetromino-t", "A build-defining Heat and Burn attack.",
    [generate("heat", [2, 3, 4]), spend("heat", [4, 4, 4], damage([6, 9, 14]), burn([6, 9, 14]))]),
  mod("thunderhead", "Thunderhead", "legendary", "arc", "strike", "tetromino-j", "A stored-up Charge burst that shocks hard.",
    [spend("charge", [4, 4, 4], damage([4, 6, 9]), shock([6, 9, 14]))]),
  mod("singularity", "Singularity", "legendary", "void", "tech", "tetromino-o", "Everything it has leeched, back at once.",
    [leech("either", [2, 3, 4]), spend("void", [4, 4, 4], damage([8, 12, 18]), poison([2, 3, 4]))]),
  mod("black-battery", "Black Battery", "legendary", "void", null, "triomino-l", "Steals Charge through the Void and stores it.",
    [capacity([2, 3, 4]), leech("charge", [2, 3, 4]), convert("void", "charge", [1, 2, 3])]),
  mod("heat-death", "Heat Death", "legendary", "void", null, "triomino-l", "Turns Heat into Void, and Void into lasting Poison.",
    [leech("heat", [2, 3, 4]), convert("heat", "void", [2, 3, 4]), spend("void", [3, 3, 3], poison([2, 3, 5]))]),
  // Neutral: the run's utility mods.
  mod("piggy-bank", "Piggy Bank", "common", "neutral", null, "single", "Pays out every payday.", [perk("income", [1, 2, 3])], "coin"),
  mod("coupon", "Coupon", "uncommon", "neutral", null, "single", "Free rerolls every day.", [perk("free-reroll", [1, 2, 3])], "ticket"),
  mod("crowd-pleaser", "Crowd Pleaser", "uncommon", "neutral", null, "domino", "Style pays out again.", [perk("style", [1, 2, 3])], "star"),
  mod("amplifier", "Amplifier", "legendary", "neutral", null, "single", "Every mod touching it gets a boost.", [], "chip",
    { kind: "boost", amount: [1, 2, 3], to: "adjacent" }),
] as const;

export type ModId = (typeof LIST)[number]["id"];

export const REGISTRY: Readonly<Record<ModId, ModDefinition>> = Object.freeze(
  Object.fromEntries(LIST.map((definition) => [definition.id, definition])) as Record<ModId, ModDefinition>,
);

/** Registry order: rarity, then family. The Armory lists and the shop draws in this order. */
export const MOD_IDS: readonly ModId[] = Object.freeze(LIST.map((definition) => definition.id));

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
  if (triples.some((triple) => triple.length !== 3 || triple.some((value) => !Number.isInteger(value) || value < 0))) say("a number that is not three whole amounts");
  if (!triples.some(([one, two, three]) => one < two && two < three)) say("nothing grows from ★ to ★★ to ★★★");
  if (definition.effects.some((effect) => (effect.kind === "spend" && effect.payoff.length === 0) || (effect.kind === "sink" && effect.per.length === 0))) say("pays for nothing");
  return problems;
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

export const DEFINITIONS: readonly ModDefinition[] = MOD_IDS.map((id) => REGISTRY[id]);
