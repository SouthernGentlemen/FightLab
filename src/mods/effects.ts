import type { Scaled } from "./stars.ts";
import type { ModType } from "./tags.ts";

/**
 * Legacy effects stay until tasks-040 so today's catalogue keeps playing unchanged. The new
 * vocabulary lives beside them and is selected by ModDefinition.effect.
 */

export const RESOURCES = ["heat", "charge", "void"] as const;
export type Resource = (typeof RESOURCES)[number];

export const STATUSES = ["burn", "shock", "poison"] as const;
export type Status = (typeof STATUSES)[number];
export const DEBUFFS = STATUSES;
export type Debuff = Status;

export type Per =
  | "flat"
  | "cell"
  | "adjacent"
  | "adjacent-same"
  | "adjacent-other"
  | Status;

export interface Amount {
  readonly value: Scaled;
  readonly per: Per;
}

export type Payoff =
  | { readonly kind: "damage"; readonly amount: Amount }
  | { readonly kind: "heal"; readonly amount: Amount }
  | { readonly kind: "status"; readonly amount: Amount }
  | { readonly kind: "cleanse"; readonly status: Status; readonly amount: Amount };

export type Condition =
  | { readonly kind: "adjacent-to"; readonly type: ModType }
  | { readonly kind: "opponent-has"; readonly status: Status };

export type ModEffect =
  | { readonly kind: "exchange"; readonly payoffs: readonly Payoff[]; readonly when?: Condition }
  | { readonly kind: "boost"; readonly amount: Scaled; readonly to: "adjacent" | "adjacent-same" }
  | { readonly kind: "perk"; readonly perk: "income" | "free-reroll" | "style"; readonly amount: Scaled };

/** What paying a legacy resource cost buys for that exchange. */
export type LegacyPayoff =
  | { readonly kind: "damage"; readonly amount: Scaled }
  | { readonly kind: "heal"; readonly amount: Scaled }
  | { readonly kind: "debuff"; readonly debuff: Debuff; readonly amount: Scaled }
  | { readonly kind: "cleanse"; readonly debuff: Debuff; readonly amount: Scaled };

export type Effect =
  | { readonly kind: "generate"; readonly resource: "heat" | "charge"; readonly amount: Scaled; readonly perAdjacent?: Scaled }
  | { readonly kind: "leech"; readonly from: "heat" | "charge" | "either"; readonly amount: Scaled }
  | { readonly kind: "convert"; readonly from: Resource; readonly to: Resource; readonly amount: Scaled }
  | { readonly kind: "spend"; readonly resource: Resource; readonly cost: Scaled; readonly payoff: readonly LegacyPayoff[] }
  | { readonly kind: "sink"; readonly resource: Resource; readonly upTo: Scaled; readonly per: readonly LegacyPayoff[] }
  | { readonly kind: "refund"; readonly amount: Scaled }
  | { readonly kind: "accrue"; readonly amount: Scaled }
  | { readonly kind: "capacity"; readonly amount: Scaled }
  | { readonly kind: "lane-boost"; readonly amount: Scaled }
  | { readonly kind: "income" | "free-reroll" | "style"; readonly amount: Scaled };

export type EffectKind = Effect["kind"];

export const FIRING: readonly EffectKind[] = ["generate", "leech", "convert", "spend", "sink", "refund"];

export const generate = (resource: "heat" | "charge", amount: Scaled, perAdjacent?: Scaled): Effect =>
  (perAdjacent ? { kind: "generate", resource, amount, perAdjacent } : { kind: "generate", resource, amount });
export const leech = (from: "heat" | "charge" | "either", amount: Scaled): Effect => ({ kind: "leech", from, amount });
export const convert = (from: Resource, to: Resource, amount: Scaled): Effect => ({ kind: "convert", from, to, amount });
export const spend = (resource: Resource, cost: Scaled, ...payoff: LegacyPayoff[]): Effect => ({ kind: "spend", resource, cost, payoff });
export const sink = (resource: Resource, upTo: Scaled, ...per: LegacyPayoff[]): Effect => ({ kind: "sink", resource, upTo, per });
export const refund = (amount: Scaled): Effect => ({ kind: "refund", amount });
export const accrue = (amount: Scaled): Effect => ({ kind: "accrue", amount });
export const capacity = (amount: Scaled): Effect => ({ kind: "capacity", amount });
export const laneBoost = (amount: Scaled): Effect => ({ kind: "lane-boost", amount });
export const perk = (kind: "income" | "free-reroll" | "style", amount: Scaled): Effect => ({ kind, amount });

export const damage = (amount: Scaled): LegacyPayoff => ({ kind: "damage", amount });
export const heal = (amount: Scaled): LegacyPayoff => ({ kind: "heal", amount });
export const burn = (amount: Scaled): LegacyPayoff => ({ kind: "debuff", debuff: "burn", amount });
export const shock = (amount: Scaled): LegacyPayoff => ({ kind: "debuff", debuff: "shock", amount });
export const poison = (amount: Scaled): LegacyPayoff => ({ kind: "debuff", debuff: "poison", amount });
export const cleanse = (debuff: Debuff, amount: Scaled): LegacyPayoff => ({ kind: "cleanse", debuff, amount });

/** Every legacy Scaled triple an effect carries, for validation and the current Armory. */
export function scaledOf(effect: Effect): Scaled[] {
  const payoffs = (list: readonly LegacyPayoff[]) => list.map((payoff) => payoff.amount);
  switch (effect.kind) {
    case "generate": return effect.perAdjacent ? [effect.amount, effect.perAdjacent] : [effect.amount];
    case "spend": return [effect.cost, ...payoffs(effect.payoff)];
    case "sink": return [effect.upTo, ...payoffs(effect.per)];
    default: return [effect.amount];
  }
}

/** Every Scaled triple carried by one new-vocabulary effect. */
export function scaledOfModEffect(effect: ModEffect): Scaled[] {
  if (effect.kind === "exchange") return effect.payoffs.map((payoff) => payoff.amount.value);
  return [effect.amount];
}
