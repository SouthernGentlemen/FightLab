import { AFFINITY_LABEL, TYPE_LABEL } from "./tags.ts";
import type { Amount, Condition, ModEffect, Payoff } from "./effects.ts";
import type { ModDefinition } from "./registry.ts";
import { scaled } from "./stars.ts";
import type { Stars } from "./stars.ts";

const STATUS = { burn: "Burn", shock: "Shock", poison: "Poison" } as const;

function plural(amount: number, word: string): string {
  return `${amount} ${word}${amount === 1 ? "" : "s"}`;
}

function amountParts(
  amount: Amount,
  definition: ModDefinition,
  stars: Stars,
): readonly [number, string] {
  const value = scaled(amount.value, stars);
  switch (amount.per) {
    case "flat": return [value, ""];
    case "cell": return [value, " per cell"];
    case "adjacent": return [value, " per adjacent mod"];
    case "adjacent-same": return [value, ` per adjacent ${TYPE_LABEL[definition.type]} mod`];
    case "adjacent-other": return [value, " per adjacent other-type mod"];
    default: return [value, ` per opponent ${STATUS[amount.per]} stack`];
  }
}

function conditionText(condition: Condition | undefined): string {
  if (condition === undefined) return "";
  return condition.kind === "adjacent-to"
    ? ` if next to ${TYPE_LABEL[condition.type]}`
    : ` if opponent has ${STATUS[condition.status]}`;
}

function actionText(definition: ModDefinition): string {
  return definition.affinity === null ? " each exchange" : ` on ${AFFINITY_LABEL[definition.affinity]}`;
}

function landingText(definition: ModDefinition): string {
  if (definition.affinity === null) return " each exchange";
  return definition.affinity === "block" ? " if guard holds" : " on a hit";
}

function payoffText(
  payoff: Payoff,
  effect: Extract<ModEffect, { kind: "exchange" }>,
  definition: ModDefinition,
  stars: Stars,
): string {
  const [amount, per] = amountParts(payoff.amount, definition, stars);
  const condition = conditionText(effect.when);
  switch (payoff.kind) {
    case "damage":
      return `+${amount} ${definition.affinity === "block" ? "riposte damage" : "damage"}${per}${actionText(definition)}${condition}`;
    case "heal":
      return `+${amount} parry heal${per}${actionText(definition)}${condition}`;
    case "status": {
      const status = definition.type === "solar" ? "Burn"
        : definition.type === "arc" ? "Shock"
          : definition.type === "void" ? "Poison" : null;
      return status === null
        ? `No status${landingText(definition)}${condition}`
        : `${status} ${amount}${per}${landingText(definition)}${condition}`;
    }
    case "cleanse":
      return `Cleanse ${STATUS[payoff.status]} ${amount}${per}${landingText(definition)}${condition}`;
  }
}

function effectText(effect: ModEffect, definition: ModDefinition, stars: Stars): string[] {
  if (effect.kind === "exchange") {
    return effect.payoffs.map((payoff) => payoffText(payoff, effect, definition, stars));
  }
  const amount = scaled(effect.amount, stars);
  if (effect.kind === "boost") {
    const target = effect.to === "adjacent"
      ? "Adjacent mods"
      : `Adjacent ${TYPE_LABEL[definition.type]} mods`;
    return [`${target} +${amount}${definition.affinity === null ? "" : ` on ${AFFINITY_LABEL[definition.affinity]}`}`];
  }
  switch (effect.perk) {
    case "income": return [`+$${amount} every payday`];
    case "free-reroll": return [`+${plural(amount, "free reroll")} every day`];
    case "style": return [`+${plural(amount, "style payout")}`];
  }
}

/** Display-ready rules at one star level. */
export function effectLines(definition: ModDefinition, stars: Stars): string[] {
  return effectText(definition.effect, definition, stars);
}
