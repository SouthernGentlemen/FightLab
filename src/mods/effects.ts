import type { Scaled } from "./stars.ts";

/**
 * What a mod does, as data. The engine in `resolve.ts` reads these kinds and nothing reads a mod's
 * id, so a new mod is a new registry entry, never a new branch of code. Every amount is a `Scaled`
 * triple — its value at ★, ★★ and ★★★.
 */

export const RESOURCES = ["heat", "charge", "void"] as const;
export type Resource = (typeof RESOURCES)[number];

export const DEBUFFS = ["burn", "shock", "poison"] as const;
export type Debuff = (typeof DEBUFFS)[number];

/** What paying a cost buys, for the exchange it was paid in. */
export type Payoff =
  /** Added to every hit of this exchange's move. A parry passes it to its riposte. */
  | { readonly kind: "damage"; readonly amount: Scaled }
  /** Added to what this exchange's parry heals, if it parries. */
  | { readonly kind: "heal"; readonly amount: Scaled }
  /** Stacks put on the opponent once the exchange has resolved. */
  | { readonly kind: "debuff"; readonly debuff: Debuff; readonly amount: Scaled }
  /** Stacks taken off its own fighter once the exchange has resolved. */
  | { readonly kind: "cleanse"; readonly debuff: Debuff; readonly amount: Scaled };

export type Effect =
  /** Step 1. Makes Heat or Charge; `perAdjacent` more for every neighbouring mod. */
  | { readonly kind: "generate"; readonly resource: "heat" | "charge"; readonly amount: Scaled; readonly perAdjacent?: Scaled }
  /** Step 2. Drains the opponent's Heat or Charge (`either`: whichever it holds more of) into Void. */
  | { readonly kind: "leech"; readonly from: "heat" | "charge" | "either"; readonly amount: Scaled }
  /** Step 2. Moves up to `amount` of its own fighter's resource into another. */
  | { readonly kind: "convert"; readonly from: Resource; readonly to: Resource; readonly amount: Scaled }
  /** Step 3. Pays exactly `cost` if it can, for the payoffs; otherwise does nothing. */
  | { readonly kind: "spend"; readonly resource: Resource; readonly cost: Scaled; readonly payoff: readonly Payoff[] }
  /** Step 3. Removes up to `upTo` and pays each payoff once per unit removed. */
  | { readonly kind: "sink"; readonly resource: Resource; readonly upTo: Scaled; readonly per: readonly Payoff[] }
  /** Step 3. Gives Charge back for every Charge spend by a neighbouring mod. */
  | { readonly kind: "refund"; readonly amount: Scaled }
  /** Step 6. Grows its fighter's Void when the round ends. */
  | { readonly kind: "accrue"; readonly amount: Scaled }
  /** Always on: raises the fighter's Charge capacity. */
  | { readonly kind: "capacity"; readonly amount: Scaled }
  /** Always on: each elemental cell of every mod touching this one powers its lane this much more. */
  | { readonly kind: "lane-boost"; readonly amount: Scaled }
  /** The run: dollars every payday, free rerolls every day, extra style payouts. */
  | { readonly kind: "income" | "free-reroll" | "style"; readonly amount: Scaled };

export type EffectKind = Effect["kind"];

/** The kinds that fire during an exchange, in the order they fire. */
export const FIRING: readonly EffectKind[] = ["generate", "leech", "convert", "spend", "sink", "refund"];

export const generate = (resource: "heat" | "charge", amount: Scaled, perAdjacent?: Scaled): Effect =>
  (perAdjacent ? { kind: "generate", resource, amount, perAdjacent } : { kind: "generate", resource, amount });
export const leech = (from: "heat" | "charge" | "either", amount: Scaled): Effect => ({ kind: "leech", from, amount });
export const convert = (from: Resource, to: Resource, amount: Scaled): Effect => ({ kind: "convert", from, to, amount });
export const spend = (resource: Resource, cost: Scaled, ...payoff: Payoff[]): Effect => ({ kind: "spend", resource, cost, payoff });
export const sink = (resource: Resource, upTo: Scaled, ...per: Payoff[]): Effect => ({ kind: "sink", resource, upTo, per });
export const refund = (amount: Scaled): Effect => ({ kind: "refund", amount });
export const accrue = (amount: Scaled): Effect => ({ kind: "accrue", amount });
export const capacity = (amount: Scaled): Effect => ({ kind: "capacity", amount });
export const laneBoost = (amount: Scaled): Effect => ({ kind: "lane-boost", amount });
export const perk = (kind: "income" | "free-reroll" | "style", amount: Scaled): Effect => ({ kind, amount });

export const damage = (amount: Scaled): Payoff => ({ kind: "damage", amount });
export const heal = (amount: Scaled): Payoff => ({ kind: "heal", amount });
export const burn = (amount: Scaled): Payoff => ({ kind: "debuff", debuff: "burn", amount });
export const shock = (amount: Scaled): Payoff => ({ kind: "debuff", debuff: "shock", amount });
export const poison = (amount: Scaled): Payoff => ({ kind: "debuff", debuff: "poison", amount });
export const cleanse = (debuff: Debuff, amount: Scaled): Payoff => ({ kind: "cleanse", debuff, amount });

/** Every `Scaled` triple an effect carries, for validation and the Armory's tables. */
export function scaledOf(effect: Effect): Scaled[] {
  const payoffs = (list: readonly Payoff[]) => list.map((payoff) => payoff.amount);
  switch (effect.kind) {
    case "generate": return effect.perAdjacent ? [effect.amount, effect.perAdjacent] : [effect.amount];
    case "spend": return [effect.cost, ...payoffs(effect.payoff)];
    case "sink": return [effect.upTo, ...payoffs(effect.per)];
    default: return [effect.amount];
  }
}
