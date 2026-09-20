import type { ActionType } from "../battle/actions.ts";
import type { Amount, ModEffect, Per, Payoff } from "./effects.ts";
import type { Rarity } from "./rarity.ts";
import type { ModDefinition } from "./registry.ts";
import type { ShapeId } from "./shapes.ts";
import type { Scaled } from "./stars.ts";
import type { ModType } from "./tags.ts";

const amount = (value: Scaled, per: Per = "flat"): Amount => ({ value, per });
const damage = (value: Scaled, per: Per = "flat"): Payoff =>
  ({ kind: "damage", amount: amount(value, per) });
const status = (value: Scaled, per: Per = "flat"): Payoff =>
  ({ kind: "status", amount: amount(value, per) });
const exchange = (...payoffs: readonly Payoff[]): ModEffect => ({ kind: "exchange", payoffs });

function draft(
  id: string,
  name: string,
  rarity: Rarity,
  type: ModType,
  affinity: ActionType | null,
  shape: ShapeId,
  effect: ModEffect,
): ModDefinition {
  return {
    id,
    name,
    description: "Target catalogue draft.",
    rarity,
    type,
    affinity,
    shape,
    effects: [],
    effect,
    visual: { glyph: type === "neutral" ? "chip" : type },
  };
}

/**
 * Solar is fast and fading: reliable damage up front, with Burn multiplying through nearby Solar
 * pieces or the opponent's current Burn before the round-end halving erodes it.
 */
export const SOLAR_CATALOGUE: readonly ModDefinition[] = Object.freeze([
  // None
  draft("kindler", "Kindler", "common", "solar", null, "domino",
    exchange(damage([1, 2, 3], "cell"))),
  draft("flashpoint", "Flashpoint", "uncommon", "solar", null, "single",
    exchange(damage([1, 2, 3]), status([1, 2, 3], "adjacent"))),
  draft("ember-lattice", "Ember Lattice", "rare", "solar", null, "triomino-i",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3], "adjacent-same"))),
  draft("daybreak-array", "Daybreak Array", "super-rare", "solar", null, "tetromino-i",
    exchange(damage([1, 2, 3], "burn"), status([1, 2, 3], "adjacent-same"))),

  // Strike
  draft("cinder-edge", "Cinder Edge", "common", "solar", "strike", "domino",
    exchange(damage([1, 2, 3], "cell"))),
  draft("searpoint", "Searpoint", "uncommon", "solar", "strike", "domino",
    exchange(damage([2, 3, 4]), status([1, 2, 3], "adjacent"))),
  draft("brand-needle", "Brand Needle", "rare", "solar", "strike", "single",
    exchange(damage([2, 3, 4]), status([1, 2, 3], "adjacent-same"))),
  draft("wildfire", "Wildfire", "legendary", "solar", "strike", "tetromino-s",
    exchange(damage([1, 2, 3], "cell"), status([2, 3, 4], "adjacent-same"))),

  // Tech
  draft("flicker-coil", "Flicker Coil", "common", "solar", "tech", "triomino-i",
    exchange(damage([1, 2, 3], "cell"))),
  draft("ash-circuit", "Ash Circuit", "uncommon", "solar", "tech", "triomino-l",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3]))),
  draft("kindling-mesh", "Kindling Mesh", "rare", "solar", "tech", "tetromino-l",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3], "adjacent-same"))),
  draft("firewalk", "Firewalk", "legendary", "solar", "tech", "tetromino-z",
    exchange(damage([1, 2, 3], "cell"), status([2, 3, 4], "adjacent-same"))),

  // Block
  draft("ember-guard", "Ember Guard", "common", "solar", "block", "tetromino-o",
    exchange(damage([3, 4, 5]))),
  draft("cinder-wall", "Cinder Wall", "uncommon", "solar", "block", "tetromino-j",
    exchange(damage([2, 3, 4]), status([2, 3, 4]))),
  draft("kiln-shield", "Kiln Shield", "rare", "solar", "block", "domino",
    exchange(damage([2, 3, 4]), status([1, 2, 3], "adjacent-same"))),
  draft("afterglow", "Afterglow", "super-rare", "solar", "block", "tetromino-t",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3], "burn"))),
]);


/**
 * Arc sets up and bursts: cheap pieces load Shock, then top-end pieces turn the opponent's current
 * stack into one heavy hit before the landed hit consumes all Shock.
 */
export const ARC_CATALOGUE: readonly ModDefinition[] = Object.freeze([
  // None
  draft("primer-coil", "Primer Coil", "common", "arc", null, "domino",
    exchange(status([1, 2, 3], "cell"))),
  draft("static-seed", "Static Seed", "uncommon", "arc", null, "single",
    exchange(status([1, 2, 3], "adjacent"))),
  draft("relay-fork", "Relay Fork", "rare", "arc", null, "triomino-l",
    exchange(status([1, 2, 3]), damage([1, 2, 3], "adjacent-same"))),
  draft("thunder-rail", "Thunder Rail", "legendary", "arc", null, "tetromino-i",
    exchange(damage([2, 3, 4], "shock"), status([1, 2, 3], "adjacent-same"))),

  // Strike
  draft("quick-jolt", "Quick Jolt", "common", "arc", "strike", "domino",
    exchange(status([1, 2, 3], "cell"))),
  draft("live-wire", "Live Wire", "uncommon", "arc", "strike", "domino",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3]))),
  draft("spark-needle", "Spark Needle", "rare", "arc", "strike", "single",
    exchange(damage([2, 3, 4]), status([1, 2, 3], "adjacent-same"))),
  draft("surge-breaker", "Surge Breaker", "super-rare", "arc", "strike", "tetromino-z",
    exchange(damage([1, 2, 3], "cell"), damage([2, 3, 4], "shock"))),

  // Tech
  draft("pulse-line", "Pulse Line", "common", "arc", "tech", "triomino-i",
    exchange(status([1, 2, 3], "cell"))),
  draft("charge-fork", "Charge Fork", "uncommon", "arc", "tech", "triomino-l",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3], "adjacent"))),
  draft("cascade-gate", "Cascade Gate", "rare", "arc", "tech", "tetromino-j",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3], "adjacent-same"))),
  draft("storm-engine", "Storm Engine", "legendary", "arc", "tech", "tetromino-s",
    exchange(damage([1, 2, 3], "cell"), damage([3, 4, 5], "shock"))),

  // Block
  draft("guard-grid", "Guard Grid", "common", "arc", "block", "tetromino-o",
    exchange(status([2, 3, 4]))),
  draft("counter-coil", "Counter Coil", "uncommon", "arc", "block", "tetromino-t",
    exchange(damage([2, 3, 4]), status([2, 3, 4]))),
  draft("shock-sink", "Shock Sink", "rare", "arc", "block", "domino",
    exchange(damage([1, 2, 3], "adjacent-same"), status([2, 3, 4]))),
  draft("flash-guard", "Flash Guard", "super-rare", "arc", "block", "tetromino-l",
    exchange(damage([3, 4, 5], "shock"), status([2, 3, 4]))),
]);
