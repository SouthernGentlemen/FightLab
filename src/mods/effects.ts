import type { Scaled } from "./stars.ts";
import type { ModType } from "./tags.ts";

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

/** Every star-value triple carried by one mod effect. */
export function scaledOf(effect: ModEffect): Scaled[] {
  if (effect.kind === "exchange") return effect.payoffs.map((payoff) => payoff.amount.value);
  return [effect.amount];
}
