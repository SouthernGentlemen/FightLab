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
const heal = (value: Scaled, per: Per = "flat"): Payoff =>
  ({ kind: "heal", amount: amount(value, per) });
const status = (value: Scaled, per: Per = "flat"): Payoff =>
  ({ kind: "status", amount: amount(value, per) });
const exchange = (...payoffs: readonly Payoff[]): ModEffect => ({ kind: "exchange", payoffs });

function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const inner of Object.values(value)) frozen(inner);
    Object.freeze(value);
  }
  return value;
}

function draft<const I extends string>(
  id: I,
  name: string,
  rarity: Rarity,
  type: ModType,
  affinity: ActionType | null,
  shape: ShapeId,
  effect: ModEffect,
): ModDefinition & { readonly id: I } {
  return frozen({
    id,
    name,
    rarity,
    type,
    affinity,
    shape,
    effect,
  });
}

/**
 * Solar is fast and fading: reliable damage up front, with Burn multiplying through nearby Solar
 * pieces or the opponent's current Burn before the round-end halving erodes it.
 */
export const SOLAR_CATALOGUE = Object.freeze([
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
  draft("ember-edge", "Cinder Edge", "common", "solar", "strike", "domino",
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
export const ARC_CATALOGUE = Object.freeze([
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
  draft("spark-wire", "Live Wire", "uncommon", "arc", "strike", "domino",
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


/**
 * Void grows over rounds: lower tiers keep adding Poison, while top-end pieces turn the opponent's
 * persistent Poison into damage without replacing the long-term stack engine.
 */
export const VOID_CATALOGUE = Object.freeze([
  // None
  draft("mire-seed", "Mire Seed", "common", "void", null, "domino",
    exchange(status([1, 2, 3], "cell"))),
  draft("deep-root", "Deep Root", "uncommon", "void", null, "single",
    exchange(status([1, 2, 3], "adjacent"))),
  draft("rot-lattice", "Rot Lattice", "rare", "void", null, "triomino-i",
    exchange(status([1, 2, 3], "adjacent-same"))),
  draft("grave-bloom", "Grave Bloom", "super-rare", "void", null, "tetromino-s",
    exchange(status([1, 2, 3], "adjacent-same"), damage([1, 2, 3], "poison"))),

  // Strike
  draft("venom-edge", "Venom Edge", "common", "void", "strike", "domino",
    exchange(status([1, 2, 3], "cell"))),
  draft("blight-fang", "Blight Fang", "uncommon", "void", "strike", "domino",
    exchange(damage([1, 2, 3]), status([1, 2, 3], "adjacent"))),
  draft("rot-needle", "Rot Needle", "rare", "void", "strike", "single",
    exchange(damage([1, 2, 3]), status([1, 2, 3], "adjacent-same"))),
  draft("deadfall", "Deadfall", "legendary", "void", "strike", "tetromino-z",
    exchange(damage([2, 3, 4], "poison"), status([1, 2, 3], "adjacent-same"))),

  // Tech
  draft("spore-line", "Spore Line", "common", "void", "tech", "triomino-i",
    exchange(status([1, 2, 3], "cell"))),
  draft("miasma-fork", "Miasma Fork", "uncommon", "void", "tech", "triomino-l",
    exchange(damage([1, 2, 3]), status([1, 2, 3], "adjacent"))),
  draft("wither-mesh", "Wither Mesh", "rare", "void", "tech", "tetromino-t",
    exchange(damage([1, 2, 3], "cell"), status([1, 2, 3], "adjacent-same"))),
  draft("blight-engine", "Blight Engine", "super-rare", "void", "tech", "tetromino-j",
    exchange(damage([1, 2, 3], "poison"), status([2, 3, 4]))),

  // Block
  draft("grave-guard", "Grave Guard", "common", "void", "block", "tetromino-o",
    exchange(status([3, 4, 5]))),
  draft("rot-wall", "Rot Wall", "uncommon", "void", "block", "tetromino-l",
    exchange(damage([2, 3, 4]), status([2, 3, 4]))),
  draft("decay-shield", "Decay Shield", "rare", "void", "block", "domino",
    exchange(damage([1, 2, 3], "adjacent-same"), status([1, 2, 3]))),
  draft("last-breath", "Last Breath", "legendary", "void", "block", "tetromino-i",
    exchange(damage([3, 4, 5], "poison"), status([2, 3, 4]))),
]);


/**
 * Neutral carries no status: its None row changes the run/build economy, while its action rows add
 * direct damage or parry healing without creating another elemental engine.
 */
export const NEUTRAL_CATALOGUE = Object.freeze([
  // None
  draft("nest-egg", "Piggy Bank", "common", "neutral", null, "domino",
    { kind: "perk", perk: "income", amount: [2, 3, 4] }),
  draft("reroll-coupon", "Coupon", "uncommon", "neutral", null, "single",
    { kind: "perk", perk: "free-reroll", amount: [1, 2, 3] }),
  draft("crowd-favorite", "Crowd Pleaser", "rare", "neutral", null, "triomino-l",
    { kind: "perk", perk: "style", amount: [1, 2, 3] }),
  draft("boost-spine", "Amplifier", "legendary", "neutral", null, "tetromino-i",
    { kind: "boost", amount: [1, 2, 3], to: "adjacent" }),

  // Strike
  draft("hardpoint", "Hardpoint", "common", "neutral", "strike", "domino",
    exchange(damage([2, 3, 4]))),
  draft("impact-rail", "Impact Rail", "uncommon", "neutral", "strike", "domino",
    exchange(damage([3, 4, 5]))),
  draft("edge-driver", "Edge Driver", "rare", "neutral", "strike", "single",
    exchange(damage([1, 2, 3], "adjacent-other"))),
  draft("breaker-frame", "Breaker Frame", "super-rare", "neutral", "strike", "tetromino-l",
    exchange(damage([2, 3, 4]), damage([1, 2, 3], "adjacent-other"))),

  // Tech
  draft("logic-line", "Logic Line", "common", "neutral", "tech", "triomino-i",
    exchange(damage([1, 2, 3], "cell"))),
  draft("vector-fork", "Vector Fork", "uncommon", "neutral", "tech", "triomino-l",
    exchange(damage([1, 2, 3], "cell"))),
  draft("signal-plate", "Signal Plate", "rare", "neutral", "tech", "tetromino-j",
    exchange(damage([1, 2, 3], "cell"), damage([1, 2, 3], "adjacent-other"))),
  draft("tuning-frame", "Tuning Frame", "super-rare", "neutral", "tech", "tetromino-z",
    exchange(damage([1, 2, 3], "cell"), damage([2, 3, 4], "adjacent-same"))),

  // Block
  draft("guard-plate", "Guard Plate", "common", "neutral", "block", "tetromino-o",
    exchange(heal([3, 4, 5]))),
  draft("brace-frame", "Brace Frame", "uncommon", "neutral", "block", "tetromino-t",
    exchange(damage([2, 3, 4]), heal([2, 3, 4]))),
  draft("counterweight", "Counterweight", "rare", "neutral", "block", "domino",
    exchange(damage([1, 2, 3], "adjacent-same"), heal([2, 3, 4]))),
  draft("bastion-core", "Bastion Core", "legendary", "neutral", "block", "tetromino-s",
    exchange(damage([2, 3, 4], "adjacent-other"), heal([4, 5, 6]))),
]);


/** Live catalogue order: type, then affinity, then rarity (§6.2). */
export const CATALOGUE = Object.freeze([
  ...SOLAR_CATALOGUE,
  ...ARC_CATALOGUE,
  ...VOID_CATALOGUE,
  ...NEUTRAL_CATALOGUE,
]);
