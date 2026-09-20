import { isActionType } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import {
  accrue, burn, capacity, cleanse, convert, damage, generate, heal, laneBoost, leech, perk, poison, refund, scaledOf, shock, sink, spend,
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
  effects: readonly Effect[], glyph?: ModGlyph,
): ModDefinition & { readonly id: I } {
  const defaultGlyph = type === "neutral" ? "chip" : type;
  return frozen({ id, name, description, rarity, type, affinity, shape, effects, visual: { glyph: glyph ?? defaultGlyph } });
}

const LIST = [
  // Common · Iron
  mod("heat-coil", "Heat Coil", "common", "solar", null, "single", "A basic Heat generator.", [generate("heat", [1, 2, 3])]),
  mod("basic-sink", "Basic Sink", "common", "solar", "block", "single", "Dumps Heat into a guard that heals.",